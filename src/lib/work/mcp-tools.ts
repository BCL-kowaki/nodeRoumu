// AI 連携（MCP）で使える道具（ツール）の一覧。
// 中身はアプリの既存の API をそのまま呼ぶだけにして、入力チェック・権限確認・業務ルールを画面と共通にする。
// 方針: 読む・追加・変更だけ。削除の道具は用意しない（削除はアプリの画面から行う）。
import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerAttendanceTools } from "./mcp-attendance";
import type { McpContext } from "./mcp-context";
import { todayJst } from "@/lib/date-jst";
import * as clientsApi from "@/app/api/work/clients/route";
import * as projectsApi from "@/app/api/work/projects/route";
import * as tasksApi from "@/app/api/work/tasks/route";
import * as taskApi from "@/app/api/work/tasks/[id]/route";
import * as attachmentsApi from "@/app/api/work/tasks/[id]/attachments/route";
import * as plansApi from "@/app/api/work/plans/route";
import * as planApi from "@/app/api/work/plans/[id]/route";
import * as entriesApi from "@/app/api/work/time-entries/route";
import * as summaryApi from "@/app/api/work/summary/route";
import * as timerApi from "@/app/api/work/timer/route";
import * as routinesApi from "@/app/api/work/routines/route";
import * as checksApi from "@/app/api/work/routines/checks/route";
import * as googleEventsApi from "@/app/api/work/google/events/route";
import * as googleStatusApi from "@/app/api/work/google/status/route";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

class ToolError extends Error {}

// 既存の API を、同じ処理の中で直接呼ぶ（ネットワークは通らない）
async function call<T = unknown>(
  handler: unknown,
  path: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string> } = {}
): Promise<T> {
  const req = new NextRequest(new URL(path, "http://node-portal.internal"), {
    method: opts.method ?? "GET",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ToolError((data as { error?: string } | null)?.error ?? `失敗しました（${res.status}）`);
  return data as T;
}

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (tool: string, e: unknown) => {
  // 想定外のエラーは原因を追えるよう記録する（鍵・入力内容は出さない）。AI には中身を見せない
  if (!(e instanceof ToolError)) console.error(`[mcp] ${tool} で失敗しました`, e instanceof Error ? e.message : e);
  return { isError: true, content: [{ type: "text" as const, text: e instanceof ToolError ? e.message : "処理に失敗しました" }] };
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("日付 YYYY-MM-DD（日本時間）");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("開始時刻 HH:MM");
const id = (what: string) => z.string().min(1).describe(`${what}のID`);

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  plannedMinutes: number | null;
  project: { id: string; name: string } | null;
  githubHtmlUrl?: string | null;
  attachmentCount?: number;
};
// AI に渡す量を減らすため、一覧は必要な項目だけにする
const slimTask = (t: TaskRow) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate?.slice(0, 10) ?? null,
  plannedMinutes: t.plannedMinutes,
  project: t.project ? { id: t.project.id, name: t.project.name } : null,
  github: t.githubHtmlUrl ?? undefined,
  attachments: t.attachmentCount || undefined,
  memo: t.description ? t.description.slice(0, 300) : undefined,
});

type Ref = { id: string; title?: string; name?: string } | null | undefined;
const refName = (r: Ref) => (r ? r.title ?? r.name : undefined);
type PlanRow = {
  id: string;
  date: string;
  title: string;
  startTime: string | null;
  plannedMinutes: number;
  taskId: string | null;
  projectId: string | null;
  routineId?: string | null;
  sourceEventId?: string | null;
  task?: Ref;
  project?: Ref;
};
const slimPlan = (p: PlanRow) => ({
  id: p.id,
  date: p.date.slice(0, 10),
  title: p.title,
  startTime: p.startTime,
  plannedMinutes: p.plannedMinutes,
  taskId: p.taskId ?? undefined,
  task: refName(p.task),
  projectId: p.projectId ?? undefined,
  project: refName(p.project),
  routineId: p.routineId ?? undefined,
  fromGoogleEvent: p.sourceEventId ? true : undefined,
});
type EntryRow = {
  id: string;
  date: string;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number | null;
  source: string;
  note: string | null;
  taskId: string | null;
  task?: Ref;
  project?: Ref;
  routine?: Ref;
};
const slimEntry = (e: EntryRow) => ({
  id: e.id,
  date: e.date.slice(0, 10),
  source: e.source,
  startedAt: e.startedAt ?? undefined,
  endedAt: e.endedAt ?? undefined,
  running: e.startedAt && !e.endedAt ? true : undefined,
  minutes: e.minutes,
  note: e.note ?? undefined,
  task: refName(e.task),
  project: refName(e.project),
  routine: refName(e.routine),
});

export function buildMcpServer(ctx: McpContext, onWrite?: (tool: string) => void): McpServer {
  const scope = ctx.scope;
  const server = new McpServer(
    { name: "node-portal", version: "1.0.0" },
    {
      instructions:
        "node-portal（代表者の業務管理）を操作する道具です。クライアント → プロジェクト → タスク の階層で、" +
        "1日の計画（時間ブロック）と実績（タイマー・手入力）を記録します。日付は日本時間の YYYY-MM-DD です。" +
        "削除はできません。給与・労働者名簿（住所・給与など）は扱いません。" +
        (ctx.attendance
          ? "出勤簿（従業員の出勤・退勤時刻など）は get_attendance で読めます" +
            (scope === "write" ? "。update_attendance で直せ、変更は履歴に残ります。給与のもとになるので、指示された内容だけを直してください。" : "。")
          : "出勤簿はこの鍵では扱えません。"),
    }
  );
  // 道具ごとに「成功なら結果、失敗ならエラー文」を返す実行役
  let current = "";
  const run = (fn: () => Promise<unknown>) => {
    const tool = current;
    return fn().then(ok, (e) => fail(tool, e));
  };
  const register: typeof server.registerTool = ((name: string, config: never, cb: (...a: never[]) => unknown) =>
    server.registerTool(name, config, ((...args: never[]) => {
      current = name;
      if (!(config as { annotations?: { readOnlyHint?: boolean } }).annotations?.readOnlyHint) onWrite?.(name);
      return cb(...args);
    }) as never)) as never;
  const read = { readOnlyHint: true, openWorldHint: false } as const;
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
  // GitHub・Google カレンダーにも反映される操作
  const writeExternal = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

  // ===== 読む =====
  register(
    "list_clients_and_projects",
    {
      title: "クライアントとプロジェクトの一覧",
      description: "クライアントと、その下のプロジェクト（状態・期限・未完了タスク数・紐づくリポジトリ）を返す。",
      inputSchema: { includeClosed: z.boolean().optional().describe("完了・アーカイブのプロジェクトも含める") },
      annotations: read,
    },
    ({ includeClosed }) =>
      run(async () => {
        const [clients, projects] = await Promise.all([
          call<{ id: string; name: string }[]>(clientsApi.GET, "/api/work/clients"),
          call<
            {
              id: string;
              clientId: string;
              name: string;
              status: string;
              dueDate: string | null;
              openTaskCount?: number;
              githubRepos?: { fullName: string }[];
            }[]
          >(projectsApi.GET, `/api/work/projects${includeClosed ? "" : "?status=active,on_hold"}`),
        ]);
        return clients.map((c) => ({
          id: c.id,
          name: c.name,
          projects: projects
            .filter((p) => p.clientId === c.id)
            .map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              dueDate: p.dueDate?.slice(0, 10) ?? null,
              openTasks: p.openTaskCount ?? 0,
              repos: p.githubRepos?.map((r) => r.fullName),
            })),
        }));
      })
  );

  register(
    "list_tasks",
    {
      title: "タスクの一覧",
      description: "タスクを返す。既定は未完了（todo・doing）。プロジェクトや期限で絞り込める。",
      inputSchema: {
        status: z.array(z.enum(["todo", "doing", "done", "canceled"])).optional().describe("状態（既定: todo, doing）"),
        projectId: z.string().optional().describe("プロジェクトID。プロジェクトなしは \"none\""),
        due: z.enum(["overdue", "today", "week"]).optional().describe("期限で絞る（期限切れ・今日まで・7日以内）"),
      },
      annotations: read,
    },
    ({ status, projectId, due }) =>
      run(async () => {
        const q = new URLSearchParams({ status: (status ?? ["todo", "doing"]).join(",") });
        if (projectId) q.set("projectId", projectId);
        if (due) q.set("due", due);
        return (await call<TaskRow[]>(tasksApi.GET, `/api/work/tasks?${q}`)).map(slimTask);
      })
  );

  register(
    "get_day",
    {
      title: "1日の計画・実績",
      description:
        "指定日（既定: 今日）の計画・実績・集計（計画と実績の分数）・その日に実施するルーティン・計測中のタイマー・Google の予定をまとめて返す。",
      inputSchema: { date: date.optional() },
      annotations: read,
    },
    ({ date: d }) =>
      run(async () => {
        const day = d ?? todayJst();
        const q = `from=${day}&to=${day}`;
        const [plans, entries, summary, routines, checks, timer, google] = await Promise.all([
          call<PlanRow[]>(plansApi.GET, `/api/work/plans?${q}`),
          call<EntryRow[]>(entriesApi.GET, `/api/work/time-entries?${q}`),
          call<{ days: { plannedMin: number; actualMin: number }[] }>(summaryApi.GET, `/api/work/summary?${q}`),
          call<{ id: string; title: string; plannedMinutes: number | null; client?: { name: string } | null }[]>(
            routinesApi.GET,
            "/api/work/routines"
          ),
          call<{ days: { items: { routineId: string; status: string | null }[] }[] }>(checksApi.GET, `/api/work/routines/checks?${q}`),
          call<EntryRow[]>(timerApi.GET, "/api/work/timer"),
          call<{ connected: boolean; status: string | null }>(googleStatusApi.GET, "/api/work/google/status"),
        ]);
        const events =
          google.connected && google.status === "active"
            ? await call(googleEventsApi.GET, `/api/work/google/events?${q}`).catch(() => "（Google の予定を取得できませんでした）")
            : "（Google カレンダー未接続）";
        return {
          date: day,
          // 出勤簿（労務）の勤務時間は AI に渡さない方針のため、計画と実績の分数だけを返す
          summary: summary.days[0] ? { plannedMin: summary.days[0].plannedMin, actualMin: summary.days[0].actualMin } : null,
          plans: plans.map(slimPlan),
          entries: entries.map(slimEntry),
          runningTimers: timer.map(slimEntry),
          routines: (checks.days[0]?.items ?? []).map((i) => {
            const r = routines.find((x) => x.id === i.routineId);
            return { routineId: i.routineId, title: r?.title, client: r?.client?.name, plannedMinutes: r?.plannedMinutes, status: i.status };
          }),
          googleEvents: events,
        };
      })
  );

  register(
    "list_task_attachments",
    {
      title: "タスクの添付資料",
      description: "タスクに添付された資料（名前・種類・大きさ・Google ドライブの URL）を返す。中身は Google ドライブで開く。",
      inputSchema: { taskId: id("タスク") },
      annotations: read,
    },
    ({ taskId }) => run(() => call(attachmentsApi.GET, `/api/work/tasks/${taskId}/attachments`, { params: { id: taskId } }))
  );

  register(
    "list_google_events",
    {
      title: "Google カレンダーの予定",
      description: "期間内の Google カレンダーの予定（読み取りのみ）。最大62日。",
      inputSchema: { from: date, to: date },
      annotations: read,
    },
    ({ from, to }) => run(() => call(googleEventsApi.GET, `/api/work/google/events?from=${from}&to=${to}`))
  );

  // 出勤簿は「出勤簿も扱う」を選んだ鍵でだけ使える（読むだけの鍵なら読むだけ）
  if (ctx.attendance) registerAttendanceTools(server, ctx, onWrite);

  if (scope !== "write") return server;

  // ===== 追加・変更 =====
  const taskFields = {
    description: z.string().nullable().optional().describe("メモ"),
    status: z.enum(["todo", "doing", "done", "canceled"]).optional(),
    priority: z.number().int().min(1).max(3).optional().describe("1=高 2=中 3=低"),
    dueDate: date.nullable().optional().describe("期限日"),
    plannedMinutes: z.number().int().min(0).max(1440).nullable().optional().describe("予定時間（分）"),
    projectId: z.string().nullable().optional().describe("プロジェクトID（なしは null）"),
  };

  register(
    "create_client",
    { title: "クライアントを追加", inputSchema: { name: z.string().min(1).max(100) }, annotations: write },
    ({ name }) => run(() => call(clientsApi.POST, "/api/work/clients", { method: "POST", body: { name } }))
  );

  register(
    "create_project",
    {
      title: "プロジェクトを追加",
      description: "クライアントの下にプロジェクトを作る。",
      inputSchema: {
        clientId: id("クライアント"),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        startDate: date.optional(),
        dueDate: date.optional(),
      },
      annotations: write,
    },
    (args) => run(() => call(projectsApi.POST, "/api/work/projects", { method: "POST", body: args }))
  );

  register(
    "create_task",
    { title: "タスクを追加", inputSchema: { title: z.string().min(1).max(200), ...taskFields }, annotations: write },
    (args) => run(async () => slimTask(await call<TaskRow>(tasksApi.POST, "/api/work/tasks", { method: "POST", body: args })))
  );

  register(
    "update_task",
    {
      title: "タスクを変更",
      description:
        "送った項目だけを変える。完了にするときは status を done にする。GitHub の Issue から取り込んだタスクは、状態の変更が GitHub の Issue にも反映される（close / reopen）。",
      inputSchema: { taskId: id("タスク"), title: z.string().min(1).max(200).optional(), ...taskFields },
      annotations: writeExternal,
    },
    ({ taskId, ...patch }) =>
      run(async () =>
        slimTask(await call<TaskRow>(taskApi.PUT, `/api/work/tasks/${taskId}`, { method: "PUT", body: patch, params: { id: taskId } }))
      )
  );

  register(
    "create_plan",
    {
      title: "計画を追加",
      description: "1日の計画（時間ブロック）を作る。タスク・ルーティンから作るときは taskId / routineId を付ける。同じ時間に複数置ける。",
      inputSchema: {
        date: date.optional().describe("日付（既定: 今日）"),
        title: z.string().min(1).max(200),
        startTime: time.optional(),
        plannedMinutes: z.number().int().min(1).max(1440),
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        routineId: z.string().optional(),
      },
      annotations: write,
    },
    ({ date: d, ...rest }) =>
      run(async () =>
        slimPlan(await call<PlanRow>(plansApi.POST, "/api/work/plans", { method: "POST", body: { date: d ?? todayJst(), ...rest } }))
      )
  );

  register(
    "update_plan",
    {
      title: "計画を変更",
      description: "開始時刻・長さ・タイトルなどを変える（送った項目だけ）。Google カレンダーに書き出し済みの計画は、カレンダーの予定も更新される。",
      inputSchema: {
        planId: id("計画"),
        title: z.string().min(1).max(200).optional(),
        startTime: time.nullable().optional(),
        plannedMinutes: z.number().int().min(1).max(1440).optional(),
        date: date.optional(),
      },
      annotations: writeExternal,
    },
    ({ planId, ...patch }) =>
      run(async () =>
        slimPlan(await call<PlanRow>(planApi.PUT, `/api/work/plans/${planId}`, { method: "PUT", body: patch, params: { id: planId } }))
      )
  );

  register(
    "start_timer",
    {
      title: "タイマーを開始",
      description:
        "作業時間の計測を始める。複数のタイマーを同時に動かせる（並行作業）。同じタスク・ルーティン・計画がすでに計測中なら、そのタイマーを返す。",
      inputSchema: {
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        routineId: z.string().optional(),
        planId: z.string().optional(),
        note: z.string().max(200).optional(),
      },
      annotations: write,
    },
    (args) =>
      run(async () => {
        return slimEntry(await call<EntryRow>(timerApi.POST, "/api/work/timer", { method: "POST", body: { action: "start", ...args } }));
      })
  );

  register(
    "stop_timer",
    {
      title: "タイマーを止める",
      description:
        "計測中のタイマーを止めて、実績として確定する。entryId（get_day の runningTimers の id）か taskId で1件を指定する。どちらも無ければ計測中をすべて止める。",
      inputSchema: {
        entryId: z.string().optional().describe("止めるタイマー（実績）のID"),
        taskId: z.string().optional().describe("このタスクで計測中のタイマーを止める"),
      },
      annotations: write,
    },
    ({ entryId, taskId }) =>
      run(async () => {
        let target = entryId;
        if (!target && taskId) {
          const running = await call<EntryRow[]>(timerApi.GET, "/api/work/timer");
          target = running.find((r) => r.taskId === taskId)?.id;
          if (!target) throw new ToolError("そのタスクで計測中のタイマーはありません");
        }
        const r = await call<EntryRow>(timerApi.POST, "/api/work/timer", {
          method: "POST",
          body: { action: "stop", ...(target ? { entryId: target } : {}) },
        });
        return slimEntry(r);
      })
  );

  register(
    "add_time_entry",
    {
      title: "実績を手入力",
      description: "タイマーを使わなかった作業時間を記録する。",
      inputSchema: {
        date: date.optional().describe("日付（既定: 今日）"),
        minutes: z.number().int().min(1).max(1440),
        note: z.string().max(200).optional(),
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        routineId: z.string().optional(),
        planId: z.string().optional(),
      },
      annotations: write,
    },
    ({ date: d, ...rest }) =>
      run(async () =>
        slimEntry(await call<EntryRow>(entriesApi.POST, "/api/work/time-entries", { method: "POST", body: { date: d ?? todayJst(), ...rest } }))
      )
  );

  register(
    "check_routine",
    {
      title: "ルーティンの実施を記録",
      description: "ルーティンをその日に実施した（done）・スキップした（skipped）と記録する。",
      inputSchema: { routineId: id("ルーティン"), date: date.optional().describe("日付（既定: 今日）"), status: z.enum(["done", "skipped"]) },
      annotations: write,
    },
    ({ routineId, date: d, status }) =>
      run(() =>
        call(checksApi.PUT, "/api/work/routines/checks", { method: "PUT", body: { routineId, date: d ?? todayJst(), status } })
      )
  );

  return server;
}
