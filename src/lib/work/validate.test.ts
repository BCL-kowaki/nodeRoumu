import { describe, expect, it } from "vitest";
import {
  completedAtFor,
  parsePlanInput,
  parseClientInput,
  parseProjectInput,
  parseRoutineCheckInput,
  parseRoutineInput,
  parseTaskInput,
  parseTimeEntryInput,
} from "./validate";

describe("parseTaskInput（タスクの作成）", () => {
  it("正しい入力のとき、前後の空白を除いた値を返す", () => {
    // Arrange
    const body = {
      title: "  見積書の作成  ",
      description: "A社向け",
      status: "doing",
      priority: 1,
      dueDate: "2026-10-10",
      plannedMinutes: 90,
      projectId: "p1",
    };
    // Act
    const r = parseTaskInput(body, "create");
    // Assert
    expect(r).toEqual({
      ok: true,
      data: {
        title: "見積書の作成",
        description: "A社向け",
        status: "doing",
        priority: 1,
        dueDate: "2026-10-10",
        plannedMinutes: 90,
        projectId: "p1",
      },
    });
  });

  it("任意項目を省略したとき、既定値（未着手・優先度 中）を補う", () => {
    const r = parseTaskInput({ title: "請求書送付" }, "create");
    expect(r).toEqual({
      ok: true,
      data: { title: "請求書送付", status: "todo", priority: 2 },
    });
  });

  it.each([
    ["タイトルが無い", {}, "タイトルを入力してください"],
    ["タイトルが空白だけ", { title: "   " }, "タイトルを入力してください"],
    ["タイトルが長すぎる", { title: "あ".repeat(201) }, "タイトルは200文字以内で入力してください"],
    ["状態が不正", { title: "a", status: "finished" }, "状態の値が正しくありません"],
    ["優先度が範囲外", { title: "a", priority: 4 }, "優先度の値が正しくありません"],
    ["優先度が数値でない", { title: "a", priority: "high" }, "優先度の値が正しくありません"],
    ["存在しない期限日", { title: "a", dueDate: "2026-02-30" }, "期限日の形式が正しくありません"],
    ["予定時間がマイナス", { title: "a", plannedMinutes: -5 }, "予定時間の値が正しくありません"],
    ["予定時間が多すぎる（24時間超）", { title: "a", plannedMinutes: 1441 }, "予定時間の値が正しくありません"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseTaskInput(body, "create")).toEqual({ ok: false, error: message });
  });

  it("期限日・予定時間・プロジェクトに null を指定したとき、未設定として受け付ける", () => {
    const r = parseTaskInput(
      { title: "a", dueDate: null, plannedMinutes: null, projectId: null, description: "" },
      "create"
    );
    expect(r).toEqual({
      ok: true,
      data: {
        title: "a",
        status: "todo",
        priority: 2,
        dueDate: null,
        plannedMinutes: null,
        projectId: null,
        description: null,
      },
    });
  });

  it("本文がオブジェクトでないとき、エラーを返す", () => {
    expect(parseTaskInput(null, "create")).toEqual({ ok: false, error: "入力内容が正しくありません" });
  });
});

describe("parseTaskInput（タスクの更新）", () => {
  it("送られた項目だけを返し、既定値は補わない", () => {
    expect(parseTaskInput({ status: "done" }, "update")).toEqual({
      ok: true,
      data: { status: "done" },
    });
  });

  it("変更する項目が1つも無いとき、エラーを返す", () => {
    expect(parseTaskInput({}, "update")).toEqual({ ok: false, error: "変更する内容がありません" });
  });

  it("更新でタイトルを空にしたとき、エラーを返す", () => {
    expect(parseTaskInput({ title: "" }, "update")).toEqual({
      ok: false,
      error: "タイトルを入力してください",
    });
  });
});

describe("completedAtFor（完了日時の記録）", () => {
  const now = new Date("2026-10-05T03:00:00Z");

  it("未完了から完了にしたとき、現在時刻を返す", () => {
    expect(completedAtFor("doing", "done", now)).toEqual(now);
  });
  it("完了から未完了に戻したとき、null（完了日時を消す）を返す", () => {
    expect(completedAtFor("done", "todo", now)).toBeNull();
  });
  it("状態が変わらないとき・状態を送らないとき、undefined（変更しない）を返す", () => {
    expect(completedAtFor("done", "done", now)).toBeUndefined();
    expect(completedAtFor("todo", undefined, now)).toBeUndefined();
  });
});

describe("parseProjectInput（プロジェクト）", () => {
  it("正しい入力のとき、値を返す", () => {
    expect(
      parseProjectInput(
        { name: " node-portal 開発 ", clientId: "c1", status: "active", color: "#21977F", startDate: "2026-10-01", dueDate: "2026-12-31" },
        "create"
      )
    ).toEqual({
      ok: true,
      data: { name: "node-portal 開発", clientId: "c1", status: "active", color: "#21977f", startDate: "2026-10-01", dueDate: "2026-12-31" },
    });
  });

  it("任意項目を省略したとき、状態を「進行中」にする", () => {
    expect(parseProjectInput({ name: "経理", clientId: "c1" }, "create")).toEqual({
      ok: true,
      data: { name: "経理", clientId: "c1", status: "active" },
    });
  });

  it("クライアントを指定しないで作成したとき、エラーを返す", () => {
    expect(parseProjectInput({ name: "経理" }, "create")).toEqual({ ok: false, error: "クライアントを選んでください" });
  });

  it("更新でクライアントを空にしようとしたとき、エラーを返す", () => {
    expect(parseProjectInput({ clientId: "" }, "update")).toEqual({ ok: false, error: "クライアントを選んでください" });
    expect(parseProjectInput({ clientId: null }, "update")).toEqual({ ok: false, error: "クライアントを選んでください" });
  });

  it("更新でクライアントだけを変えたとき、その値だけを返す", () => {
    expect(parseProjectInput({ clientId: "c2" }, "update")).toEqual({ ok: true, data: { clientId: "c2" } });
  });

  it.each([
    ["名前が無い", {}, "プロジェクト名を入力してください"],
    ["名前が長すぎる", { name: "あ".repeat(101), clientId: "c1" }, "プロジェクト名は100文字以内で入力してください"],
    ["状態が不正", { name: "a", status: "closed", clientId: "c1" }, "状態の値が正しくありません"],
    ["色の形式が不正", { name: "a", color: "red", clientId: "c1" }, "色は #RRGGBB の形式で指定してください"],
    ["期限が開始より前", { name: "a", startDate: "2026-10-10", dueDate: "2026-10-01", clientId: "c1" }, "期限日は開始日以降にしてください"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseProjectInput(body, "create")).toEqual({ ok: false, error: message });
  });

  it("更新で変更する項目が無いとき、エラーを返す", () => {
    expect(parseProjectInput({}, "update")).toEqual({ ok: false, error: "変更する内容がありません" });
  });
});

describe("parseClientInput（クライアント）", () => {
  it("正しい入力のとき、前後の空白を除いた名前を返す", () => {
    expect(parseClientInput({ name: "  株式会社サンプル  " }, "create")).toEqual({ ok: true, data: { name: "株式会社サンプル" } });
  });

  it.each([
    ["名前が無い", {}, "クライアント名を入力してください"],
    ["名前が空白だけ", { name: "   " }, "クライアント名を入力してください"],
    ["名前が長すぎる", { name: "あ".repeat(101) }, "クライアント名は100文字以内で入力してください"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseClientInput(body, "create")).toEqual({ ok: false, error: message });
  });

  it("更新で変更する項目が無いとき、エラーを返す", () => {
    expect(parseClientInput({}, "update")).toEqual({ ok: false, error: "変更する内容がありません" });
  });
});

describe("parseRoutineInput（ルーティン）", () => {
  it("毎週のとき、曜日と開始日を受け付ける（既定: 有効・休日を除かない）", () => {
    expect(
      parseRoutineInput(
        { title: " 週次レポート ", frequency: "weekly", weekdays: 2, startDate: "2026-10-05" },
        "create"
      )
    ).toEqual({
      ok: true,
      data: { title: "週次レポート", frequency: "weekly", weekdays: 2, startDate: "2026-10-05", active: true, skipClosedDays: false },
    });
  });

  it("開始日を省略したとき、エラーにせず呼び出し側で今日を入れられるよう未設定のまま返す", () => {
    const r = parseRoutineInput({ title: "日報", frequency: "daily" }, "create");
    expect(r).toEqual({ ok: true, data: { title: "日報", frequency: "daily", active: true, skipClosedDays: false } });
  });

  it.each([
    ["名前が無い", { frequency: "daily" }, "ルーティン名を入力してください"],
    ["頻度が不正", { title: "a", frequency: "yearly" }, "繰り返しの値が正しくありません"],
    ["毎週なのに曜日が無い", { title: "a", frequency: "weekly", weekdays: 0 }, "曜日を1つ以上選んでください"],
    ["曜日の値が範囲外", { title: "a", frequency: "weekly", weekdays: 128 }, "曜日を1つ以上選んでください"],
    ["毎月なのに日付が無い", { title: "a", frequency: "monthly" }, "毎月の日付は1〜31日か月末を選んでください"],
    ["毎月の日付が範囲外", { title: "a", frequency: "monthly", monthDay: 32 }, "毎月の日付は1〜31日か月末を選んでください"],
    ["終了日が開始日より前", { title: "a", frequency: "daily", startDate: "2026-10-10", endDate: "2026-10-01" }, "終了日は開始日以降にしてください"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseRoutineInput(body, "create")).toEqual({ ok: false, error: message });
  });

  it("更新で停止だけ送ったとき、その項目だけを返す", () => {
    expect(parseRoutineInput({ active: false }, "update")).toEqual({ ok: true, data: { active: false } });
  });
});

describe("parseRoutineCheckInput（実施チェック）", () => {
  it("実施・スキップと日付を受け付ける", () => {
    expect(parseRoutineCheckInput({ routineId: "r1", date: "2026-10-05", status: "done" })).toEqual({
      ok: true,
      data: { routineId: "r1", date: "2026-10-05", status: "done" },
    });
  });
  it.each([
    ["ルーティンの指定が無い", { date: "2026-10-05", status: "done" }, "ルーティンの指定が正しくありません"],
    ["日付が不正", { routineId: "r1", date: "10/5", status: "done" }, "日付の形式が正しくありません"],
    ["状態が不正", { routineId: "r1", date: "2026-10-05", status: "ok" }, "状態の値が正しくありません"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseRoutineCheckInput(body)).toEqual({ ok: false, error: message });
  });
});

describe("parsePlanInput（業務計画）", () => {
  it("日付・開始時刻・予定分数・タイトルを受け付ける", () => {
    expect(
      parsePlanInput({ date: "2026-10-06", startTime: "09:30", plannedMinutes: 90, title: " 見積作成 ", taskId: "t1" }, "create")
    ).toEqual({
      ok: true,
      data: { date: "2026-10-06", startTime: "09:30", plannedMinutes: 90, title: "見積作成", taskId: "t1" },
    });
  });
  it.each([
    ["タイトルが無い", { date: "2026-10-06", plannedMinutes: 30 }, "タイトルを入力してください"],
    ["日付が無い", { title: "a", plannedMinutes: 30 }, "日付の形式が正しくありません"],
    ["予定時間が無い", { title: "a", date: "2026-10-06" }, "予定時間は1〜1440分で入力してください"],
    ["予定時間が0分", { title: "a", date: "2026-10-06", plannedMinutes: 0 }, "予定時間は1〜1440分で入力してください"],
    ["開始時刻の形式が不正", { title: "a", date: "2026-10-06", plannedMinutes: 30, startTime: "25:00" }, "開始時刻は HH:MM の形式で入力してください"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parsePlanInput(body, "create")).toEqual({ ok: false, error: message });
  });
});

describe("parseTimeEntryInput（実績の手入力）", () => {
  it("日付と分数を受け付ける", () => {
    expect(parseTimeEntryInput({ date: "2026-10-06", minutes: 45, note: "電話対応", projectId: "p1" }, "create")).toEqual({
      ok: true,
      data: { date: "2026-10-06", minutes: 45, note: "電話対応", projectId: "p1" },
    });
  });
  it.each([
    ["分数が無い", { date: "2026-10-06" }, "時間は1〜1440分で入力してください"],
    ["分数が多すぎる", { date: "2026-10-06", minutes: 1441 }, "時間は1〜1440分で入力してください"],
    ["日付が不正", { date: "2026-13-01", minutes: 10 }, "日付の形式が正しくありません"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseTimeEntryInput(body, "create")).toEqual({ ok: false, error: message });
  });
  it("更新でメモだけ送ったとき、その項目だけを返す", () => {
    expect(parseTimeEntryInput({ note: "" }, "update")).toEqual({ ok: true, data: { note: null } });
  });
});
