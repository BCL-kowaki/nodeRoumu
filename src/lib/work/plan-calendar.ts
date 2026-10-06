// 計画 → Google カレンダー（専用カレンダー「業務計画」）への書き出し
import { prisma } from "@/lib/prisma";
import { GcalError, deleteEvent, ensurePlanCalendar, getAccessToken, getConnection, upsertEvent } from "@/lib/google-calendar";
import { planEventBody } from "./gcal";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export type ExportResult = { exported: number; skippedNoTime: number; failed: number; error?: string };

// 指定期間の計画を書き出す（開始時刻のない計画は書き出さない）。再実行すると同じ予定を更新する
export async function exportPlans(ownerId: string, from: Date, to: Date): Promise<ExportResult> {
  const plans = await prisma.workPlan.findMany({
    where: { ownerId, date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const result: ExportResult = { exported: 0, skippedNoTime: 0, failed: 0 };
  const token = await getAccessToken(ownerId);
  const calendarId = await ensurePlanCalendar(ownerId, token);

  for (const plan of plans) {
    const body = planEventBody({ id: plan.id, date: ymd(plan.date), startTime: plan.startTime, plannedMinutes: plan.plannedMinutes, title: plan.title });
    if (!body) {
      result.skippedNoTime++;
      continue;
    }
    try {
      const eventId = await upsertEvent(token, calendarId, plan.googleEventId, body);
      await prisma.workPlan.update({ where: { id: plan.id }, data: { googleEventId: eventId, googleSyncedAt: new Date() } });
      result.exported++;
    } catch (e) {
      // 権限・認証・回数制限は続けても無駄なので止める。それ以外は1件の失敗として数える
      if (e instanceof GcalError && [401, 403, 429].includes(e.status)) throw e;
      result.failed++;
    }
  }
  await prisma.integrationAccount.updateMany({ where: { ownerId, provider: "google" }, data: { lastSyncedAt: new Date() } });
  return result;
}

// 計画の削除・変更に合わせて、書き出し済みの予定を整える。失敗しても計画の操作自体は成功させる
export async function removePlanEvent(ownerId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    const acc = await getConnection(ownerId);
    if (!acc?.calendarId || acc.status !== "active") return;
    await deleteEvent(await getAccessToken(ownerId), acc.calendarId, googleEventId);
  } catch (e) {
    console.error("Google カレンダーの予定を削除できませんでした", e instanceof GcalError ? e.status : "");
  }
}

export async function resyncPlanEvent(ownerId: string, planId: string): Promise<void> {
  try {
    const plan = await prisma.workPlan.findFirst({ where: { id: planId, ownerId } });
    if (!plan?.googleEventId) return;
    const acc = await getConnection(ownerId);
    if (!acc?.calendarId || acc.status !== "active") return;
    const token = await getAccessToken(ownerId);
    const body = planEventBody({ id: plan.id, date: ymd(plan.date), startTime: plan.startTime, plannedMinutes: plan.plannedMinutes, title: plan.title });
    if (!body) {
      // 開始時刻を外した計画は、カレンダーから消す
      await deleteEvent(token, acc.calendarId, plan.googleEventId);
      await prisma.workPlan.update({ where: { id: plan.id }, data: { googleEventId: null, googleSyncedAt: null } });
      return;
    }
    const eventId = await upsertEvent(token, acc.calendarId, plan.googleEventId, body);
    await prisma.workPlan.update({ where: { id: plan.id }, data: { googleEventId: eventId, googleSyncedAt: new Date() } });
  } catch (e) {
    console.error("Google カレンダーの予定を更新できませんでした", e instanceof GcalError ? e.status : "");
  }
}
