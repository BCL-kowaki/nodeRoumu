// API の期間指定（?from=YYYY-MM-DD&to=YYYY-MM-DD）の読み取り
import { addDays, jstDateToDb } from "@/lib/date-jst";

export const MAX_RANGE_DAYS = 62;

export function parseRange(sp: URLSearchParams): { from: string; to: string } | { error: string } {
  const from = sp.get("from");
  const to = sp.get("to") ?? from;
  const ok = (s: string | null): s is string => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    try {
      jstDateToDb(s);
      return true;
    } catch {
      return false;
    }
  };
  if (!ok(from) || !ok(to) || to < from) return { error: "期間の指定が正しくありません" };
  if (to > addDays(from, MAX_RANGE_DAYS - 1)) return { error: `期間は${MAX_RANGE_DAYS}日以内で指定してください` };
  return { from, to };
}
