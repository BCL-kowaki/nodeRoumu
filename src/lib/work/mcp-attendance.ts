// AI 連携（MCP）で出勤簿を扱う道具。「出勤簿も扱う」を選んだ鍵でだけ登録する。
// - 従業員の情報は名前・雇用形態・シフトだけを渡す（住所・生年月日・給与・電話番号は渡さない）
// - 読む＋修正のみ（削除なし）。修正は必ず変更履歴（AttendanceChange）に残す
// - 画面用の出勤簿 API は使わず、ここで厳しく入力を確かめてから保存する
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, workMinutes } from "@/lib/attendance-status";
import { diffAttendance, parseAttendancePatch, type AttendanceFields } from "@/lib/attendance-edit";
import { addDays, jstDateToDb } from "@/lib/date-jst";
import type { McpContext } from "./mcp-context";

class ToolError extends Error {}

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (tool: string, e: unknown) => {
  if (!(e instanceof ToolError)) console.error(`[mcp] ${tool} で失敗しました`, e instanceof Error ? e.message : e);
  return { isError: true, content: [{ type: "text" as const, text: e instanceof ToolError ? e.message : "処理に失敗しました" }] };
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const FIELDS = { startTime: true, endTime: true, breakMinutes: true, status: true, memo: true } as const;

async function findWorker(employeeId: string) {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
  if (!e) throw new ToolError("従業員が見つかりません");
  return e;
}

export function registerAttendanceTools(server: McpServer, ctx: McpContext, onWrite?: (tool: string) => void) {
  const read = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool(
    "list_employees",
    {
      title: "従業員の一覧（出勤簿用）",
      description: "出勤簿を見る・直すための従業員の一覧。名前・雇用形態・決まった勤務時間（シフト）・退職日だけを返す。",
      inputSchema: { includeResigned: z.boolean().optional().describe("退職した人も含める") },
      annotations: read,
    },
    async ({ includeResigned }) => {
      try {
        const rows = await prisma.employee.findMany({
          where: includeResigned ? {} : { resignDate: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, employmentType: true, shiftStart: true, shiftEnd: true, shiftBreak: true, resignDate: true },
        });
        return ok(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            employmentType: r.employmentType,
            shift: r.shiftStart && r.shiftEnd ? `${r.shiftStart}〜${r.shiftEnd}（休憩${r.shiftBreak ?? 0}分）` : null,
            resignDate: r.resignDate ? ymd(r.resignDate) : undefined,
          }))
        );
      } catch (e) {
        return fail("list_employees", e);
      }
    }
  );

  server.registerTool(
    "get_attendance",
    {
      title: "出勤簿（1か月分）",
      description:
        "従業員の1か月分の出勤簿（出勤・退勤時刻、休憩、状態、備考、実働分数）と合計を返す。状態: " +
        Object.entries(STATUS_LABELS)
          .map(([k, v]) => `${k}=${v}`)
          .join("、"),
      inputSchema: {
        employeeId: z.string().min(1).describe("従業員のID（list_employees で調べる）"),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("月 YYYY-MM"),
      },
      annotations: read,
    },
    async ({ employeeId, month }) => {
      try {
        const worker = await findWorker(employeeId);
        const from = `${month}-01`;
        const next = addDays(`${month}-28`, 4).slice(0, 7) + "-01"; // 翌月1日
        const records = await prisma.attendance.findMany({
          where: { employeeId, date: { gte: jstDateToDb(from), lt: jstDateToDb(next) } },
          orderBy: { date: "asc" },
          select: { date: true, ...FIELDS },
        });
        const days = records.map((r) => ({
          date: ymd(r.date),
          startTime: r.startTime,
          endTime: r.endTime,
          breakMinutes: r.breakMinutes,
          status: r.status,
          memo: r.memo ?? undefined,
          workMinutes: workMinutes(r.startTime, r.endTime, r.breakMinutes),
        }));
        return ok({
          employee: worker.name,
          month,
          totalWorkMinutes: days.reduce((s, d) => s + (d.workMinutes ?? 0), 0),
          days,
        });
      } catch (e) {
        return fail("get_attendance", e);
      }
    }
  );

  if (ctx.scope !== "write") return;

  server.registerTool(
    "update_attendance",
    {
      title: "出勤簿を修正",
      description:
        "従業員のある日の出勤簿を直す（記録が無い日は作る）。送った項目だけを変える。時刻は HH:MM、null で消す。" +
        "変更は必ず変更履歴に残り、出勤簿の画面で確認できる。給与計算のもとになるので、指示された内容だけを直すこと。",
      inputSchema: {
        employeeId: z.string().min(1).describe("従業員のID"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("日付 YYYY-MM-DD"),
        startTime: z.string().nullable().optional().describe("出勤時刻 HH:MM"),
        endTime: z.string().nullable().optional().describe("退勤時刻 HH:MM"),
        breakMinutes: z.number().int().nullable().optional().describe("休憩（分）"),
        status: z.string().nullable().optional().describe("状態（null で自動）"),
        memo: z.string().nullable().optional().describe("備考"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ employeeId, date, ...rest }) => {
      onWrite?.("update_attendance");
      try {
        const parsed = parseAttendancePatch(rest);
        if (!parsed.ok) throw new ToolError(parsed.error);
        let day: Date;
        try {
          day = jstDateToDb(date);
        } catch {
          throw new ToolError("日付が正しくありません");
        }
        const worker = await findWorker(employeeId);

        const result = await prisma.$transaction(async (tx) => {
          const before = await tx.attendance.findUnique({
            where: { employeeId_date: { employeeId, date: day } },
            select: FIELDS,
          });
          const changes = diffAttendance(before as AttendanceFields | null, parsed.data);
          if (Object.keys(changes).length === 0) return { changed: false as const, record: before };
          const record = await tx.attendance.upsert({
            where: { employeeId_date: { employeeId, date: day } },
            update: parsed.data,
            create: {
              employeeId,
              date: day,
              startTime: parsed.data.startTime ?? null,
              endTime: parsed.data.endTime ?? null,
              breakMinutes: parsed.data.breakMinutes ?? null,
              status: parsed.data.status ?? null,
              memo: parsed.data.memo ?? null,
            },
            select: FIELDS,
          });
          await tx.attendanceChange.create({
            data: {
              employeeId,
              date: day,
              changes,
              source: "ai",
              tokenId: ctx.tokenId,
              tokenName: ctx.tokenName,
              changedById: ctx.ownerId,
            },
          });
          return { changed: true as const, record, changes };
        });

        if (!result.changed) return ok({ employee: worker.name, date, message: "変更はありませんでした（同じ内容です）" });
        const r = result.record!;
        return ok({
          employee: worker.name,
          date,
          changes: result.changes,
          now: { ...r, workMinutes: workMinutes(r.startTime, r.endTime, r.breakMinutes) },
        });
      } catch (e) {
        return fail("update_attendance", e);
      }
    }
  );
}
