import { describe, expect, it } from "vitest";
import {
  completedAtFor,
  parseProjectInput,
  parseTaskInput,
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
        { name: " node-portal 開発 ", status: "active", color: "#21977F", startDate: "2026-10-01", dueDate: "2026-12-31" },
        "create"
      )
    ).toEqual({
      ok: true,
      data: { name: "node-portal 開発", status: "active", color: "#21977f", startDate: "2026-10-01", dueDate: "2026-12-31" },
    });
  });

  it("任意項目を省略したとき、状態を「進行中」にする", () => {
    expect(parseProjectInput({ name: "経理" }, "create")).toEqual({
      ok: true,
      data: { name: "経理", status: "active" },
    });
  });

  it.each([
    ["名前が無い", {}, "プロジェクト名を入力してください"],
    ["名前が長すぎる", { name: "あ".repeat(101) }, "プロジェクト名は100文字以内で入力してください"],
    ["状態が不正", { name: "a", status: "closed" }, "状態の値が正しくありません"],
    ["色の形式が不正", { name: "a", color: "red" }, "色は #RRGGBB の形式で指定してください"],
    ["期限が開始より前", { name: "a", startDate: "2026-10-10", dueDate: "2026-10-01" }, "期限日は開始日以降にしてください"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseProjectInput(body, "create")).toEqual({ ok: false, error: message });
  });

  it("更新で変更する項目が無いとき、エラーを返す", () => {
    expect(parseProjectInput({}, "update")).toEqual({ ok: false, error: "変更する内容がありません" });
  });
});
