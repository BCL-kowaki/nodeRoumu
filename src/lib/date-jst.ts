// 日本時間（JST, UTC+9）基準の日付ユーティリティ
// new Date().toISOString().slice(0, 10) は UTC 基準のため、日本時間の 0〜9 時は前日になる。
// 業務管理機能（ルーティン・時間記録など）はこちらを使う。
// ※ 既存画面の todayStr（UTC 基準）は別途判断のうえ置き換える（2026-10 時点では未対応）

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 指定時刻の日本時間での日付 "YYYY-MM-DD"
export function toJstDateStr(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// 今日（日本時間）"YYYY-MM-DD"
export function todayJst(now: Date = new Date()): string {
  return toJstDateStr(now);
}

// "YYYY-MM-DD" を DB の @db.Date 列に保存する Date（UTC 0 時）に変換する
export function jstDateToDb(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`日付の形式が正しくありません: ${dateStr}`);
  }
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateStr) {
    throw new Error(`存在しない日付です: ${dateStr}`);
  }
  return d;
}

// "YYYY-MM-DD" に日数を足す（月末・年末・うるう年をまたいでも正しく計算）
export function addDays(dateStr: string, days: number): string {
  const d = jstDateToDb(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
