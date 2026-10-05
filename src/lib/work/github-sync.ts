// GitHub の Issue とタスクの同期ルール（決まった答えになる処理なのでテストで固定）
//
// どちらを正とするか:
// - Issue 由来の項目（タイトル・open/closed・URL）は GitHub を正とする
// - アプリにしかない項目（優先度・期限・予定時間・プロジェクト・メモ）はアプリを正とし、同期で上書きしない

export type GhIssue = {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  updated_at: string;
  pull_request?: unknown; // これがあるものはプルリクエスト（Issue 一覧に混ざって返る）
};

export type SyncedTask = {
  id: string;
  githubIssueNumber: number | null;
  githubUpdatedAt: Date | null;
  status: string;
};

type IssueFields = {
  title: string;
  githubState: string;
  githubUpdatedAt: Date;
  githubHtmlUrl: string;
};

export type TaskCreate = IssueFields & { status: "todo"; githubIssueNumber: number };
export type TaskUpdate = {
  id: string;
  data: IssueFields & { status?: string; completedAt?: Date | null };
};

const CLOSED_STATUSES = ["done", "canceled"];

// 取り込んだ Issue の一覧から、作るタスク・更新するタスクを決める
export function planIssueSync(
  existing: SyncedTask[],
  issues: GhIssue[],
  now: Date
): { creates: TaskCreate[]; updates: TaskUpdate[]; skipped: number } {
  const creates: TaskCreate[] = [];
  const updates: TaskUpdate[] = [];
  let skipped = 0;

  for (const issue of issues) {
    if (issue.pull_request) {
      skipped++;
      continue;
    }
    const updatedAt = new Date(issue.updated_at);
    const fields: IssueFields = {
      title: issue.title,
      githubState: issue.state,
      githubUpdatedAt: updatedAt,
      githubHtmlUrl: issue.html_url,
    };
    const task = existing.find((t) => t.githubIssueNumber === issue.number);

    if (!task) {
      // 過去に閉じられた Issue まで取り込むと一覧が埋まるため、open のものだけ新規に作る
      if (issue.state === "open") {
        creates.push({ ...fields, status: "todo", githubIssueNumber: issue.number });
      } else skipped++;
      continue;
    }

    // 取り込み済みで GitHub 側に変更が無ければ何もしない（自分の書き込みを二重に反映しない）
    if (task.githubUpdatedAt && updatedAt.getTime() <= task.githubUpdatedAt.getTime()) {
      skipped++;
      continue;
    }

    const data: TaskUpdate["data"] = { ...fields };
    const taskClosed = CLOSED_STATUSES.includes(task.status);
    if (issue.state === "closed" && !taskClosed) {
      data.status = "done";
      data.completedAt = now;
    } else if (issue.state === "open" && taskClosed) {
      data.status = "todo";
      data.completedAt = null;
    }
    updates.push({ id: task.id, data });
  }
  return { creates, updates, skipped };
}

// タスクの状態に対応する Issue の状態
export function issueStateFor(status: string): { state: "open" | "closed"; state_reason?: "completed" | "not_planned" } {
  if (status === "done") return { state: "closed", state_reason: "completed" };
  if (status === "canceled") return { state: "closed", state_reason: "not_planned" };
  return { state: "open" };
}

// アプリでの状態変更を GitHub に反映する必要があるか（open/closed や close の理由が変わるときだけ）
export function needsIssueUpdate(prevStatus: string, nextStatus: string | undefined): boolean {
  if (nextStatus === undefined || nextStatus === prevStatus) return false;
  const a = issueStateFor(prevStatus);
  const b = issueStateFor(nextStatus);
  return a.state !== b.state || a.state_reason !== b.state_reason;
}

// GitHub API の Link ヘッダーから最終ページ番号を読む（per_page=1 で件数を数えるときに使う）
export function parseLastPage(link: string | null): number | null {
  if (!link) return null;
  const m = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return m ? Number(m[1]) : null;
}
