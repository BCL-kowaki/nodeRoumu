// ルーティンのサーバー側の共通処理（DB の行 → 判定用の形、休日の読み込み）
import type { Routine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isClosedDay } from "@/lib/attendance-status";
import { jstDateToDb } from "@/lib/date-jst";
import type { Frequency, RecurrenceRule } from "./recurrence";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function toRule(r: Routine): RecurrenceRule {
  return {
    frequency: r.frequency as Frequency,
    weekdays: r.weekdays,
    monthDay: r.monthDay,
    skipClosedDays: r.skipClosedDays,
    active: r.active,
    startDate: ymd(r.startDate),
    endDate: r.endDate ? ymd(r.endDate) : null,
  };
}

// 期間内の休日判定（定休曜日 + 会社休日・祝日の登録日）。勤怠と同じ isClosedDay を使う
export async function loadClosedChecker(from: string, to: string): Promise<(date: string) => boolean> {
  const [rate, closedDates] = await Promise.all([
    prisma.rate.findFirst(),
    prisma.closedDate.findMany({
      where: { date: { gte: jstDateToDb(from), lte: jstDateToDb(to) } },
      select: { date: true },
    }),
  ]);
  const list = closedDates.map((c) => ({ date: ymd(c.date) }));
  return (date: string) => isClosedDay(date, rate, list);
}
