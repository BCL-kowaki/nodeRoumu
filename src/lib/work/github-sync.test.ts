import { describe, expect, it } from "vitest";
import {
  issueStateFor,
  needsIssueUpdate,
  parseLastPage,
  planIssueSync,
  type GhIssue,
  type SyncedTask,
} from "./github-sync";

const now = new Date("2026-10-06T03:00:00Z");
const issue = (n: number, over: Partial<GhIssue> = {}): GhIssue => ({
  number: n,
  title: `Issue ${n}`,
  state: "open",
  html_url: `https://github.com/o/r/issues/${n}`,
  updated_at: "2026-10-05T00:00:00Z",
  ...over,
});
const task = (n: number, over: Partial<SyncedTask> = {}): SyncedTask => ({
  id: `t${n}`,
  githubIssueNumber: n,
  githubUpdatedAt: new Date("2026-10-01T00:00:00Z"),
  status: "todo",
  ...over,
});

describe("planIssueSync（Issue をタスクに反映する計画）", () => {
  it("新しい open の Issue のとき、未着手のタスクとして作る", () => {
    const r = planIssueSync([], [issue(1)], now);
    expect(r.creates).toEqual([
      {
        title: "Issue 1",
        status: "todo",
        githubIssueNumber: 1,
        githubState: "open",
        githubUpdatedAt: new Date("2026-10-05T00:00:00Z"),
        githubHtmlUrl: "https://github.com/o/r/issues/1",
      },
    ]);
    expect(r.updates).toEqual([]);
  });

  it("新しい closed の Issue のとき、過去の完了分は取り込まない", () => {
    expect(planIssueSync([], [issue(1, { state: "closed" })], now).creates).toEqual([]);
  });

  it("プルリクエストのとき、取り込まない", () => {
    const r = planIssueSync([], [issue(1, { pull_request: {} })], now);
    expect(r.creates).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("取り込み済みで GitHub 側が更新されていないとき、何もしない", () => {
    const r = planIssueSync([task(1, { githubUpdatedAt: new Date("2026-10-05T00:00:00Z") })], [issue(1)], now);
    expect(r.updates).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("GitHub で close されたとき、タスクを完了にし完了日時を記録する", () => {
    const r = planIssueSync([task(1)], [issue(1, { state: "closed", title: "直した" })], now);
    expect(r.updates).toEqual([
      {
        id: "t1",
        data: {
          title: "直した",
          githubState: "closed",
          githubUpdatedAt: new Date("2026-10-05T00:00:00Z"),
          githubHtmlUrl: "https://github.com/o/r/issues/1",
          status: "done",
          completedAt: now,
        },
      },
    ]);
  });

  it("GitHub で reopen されたとき、完了済みのタスクを未着手に戻す", () => {
    const r = planIssueSync([task(1, { status: "done" })], [issue(1)], now);
    expect(r.updates[0].data).toMatchObject({ status: "todo", completedAt: null, githubState: "open" });
  });

  it("状態が変わらない更新（タイトル変更など）のとき、アプリ側の状態（進行中）は保つ", () => {
    const r = planIssueSync([task(1, { status: "doing" })], [issue(1, { title: "名前変更" })], now);
    expect(r.updates[0].data).not.toHaveProperty("status");
    expect(r.updates[0].data.title).toBe("名前変更");
  });

  it("GitHub で close されたが、アプリで中止にしていたとき、中止のまま保つ", () => {
    const r = planIssueSync([task(1, { status: "canceled" })], [issue(1, { state: "closed" })], now);
    expect(r.updates[0].data).not.toHaveProperty("status");
  });
});

describe("issueStateFor / needsIssueUpdate（アプリの操作を GitHub に反映）", () => {
  it.each([
    ["todo", { state: "open" }],
    ["doing", { state: "open" }],
    ["done", { state: "closed", state_reason: "completed" }],
    ["canceled", { state: "closed", state_reason: "not_planned" }],
  ])("タスクが %s のとき、Issue は %o", (status, expected) => {
    expect(issueStateFor(status)).toEqual(expected);
  });

  it("未完了と完了・中止の境目をまたいだときだけ、GitHub を更新する", () => {
    expect(needsIssueUpdate("todo", "done")).toBe(true);
    expect(needsIssueUpdate("done", "doing")).toBe(true);
    expect(needsIssueUpdate("done", "canceled")).toBe(true); // 理由（完了→対応しない）が変わる
    expect(needsIssueUpdate("todo", "doing")).toBe(false);
    expect(needsIssueUpdate("todo", undefined)).toBe(false);
  });
});

describe("parseLastPage（件数を数えるためのページ数の読み取り）", () => {
  it("Link ヘッダーの last から最終ページ番号を返す", () => {
    const link =
      '<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=7>; rel="last"';
    expect(parseLastPage(link)).toBe(7);
  });
  it("Link ヘッダーが無いとき、null を返す（1ページに収まっている）", () => {
    expect(parseLastPage(null)).toBeNull();
  });
});
