// 給与の締日・支払日を算出するヘルパー
// 合同会社node の給与ルール：月末締め・翌月末支払い

/**
 * 指定月（"YYYY-MM"）の締日を "YYYY-MM-DD" で返す
 * 例: "2026-04" → "2026-04-30"
 */
export function getClosingDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // new Date(y, m, 0) で当月末日を取得（mは0-indexedだが0日指定で前月末=当月末になる）
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/**
 * 指定月（"YYYY-MM"）の支払日（翌月末）を "YYYY-MM-DD" で返す
 * 例: "2026-04" → "2026-05-31"
 * 例: "2026-12" → "2027-01-31"
 */
export function getPayDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // 翌月末 = 翌々月の0日
  // m+1 が 13 になっても Date は翌年1月として正しく扱う
  const nextMonth = m + 1; // 1-12 or 13
  const last = new Date(y, nextMonth, 0).getDate();
  const year = nextMonth === 13 ? y + 1 : y;
  const mon = nextMonth === 13 ? 1 : nextMonth;
  return `${year}-${String(mon).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/**
 * "YYYY-MM-DD" を "YYYY年M月D日（曜）" 形式で表示
 */
export function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
}
