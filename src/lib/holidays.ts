// 日本の祝日データ（2026年）
// 振替休日・国民の休日も含む

export type HolidayEntry = {
  date: string; // YYYY-MM-DD
  name: string;
};

export const NATIONAL_HOLIDAYS_2026: HolidayEntry[] = [
  { date: "2026-01-01", name: "元日" },
  { date: "2026-01-12", name: "成人の日" },
  { date: "2026-02-11", name: "建国記念の日" },
  { date: "2026-02-23", name: "天皇誕生日" },
  { date: "2026-03-20", name: "春分の日" },
  { date: "2026-04-29", name: "昭和の日" },
  { date: "2026-05-03", name: "憲法記念日" },
  { date: "2026-05-04", name: "みどりの日" },
  { date: "2026-05-05", name: "こどもの日" },
  { date: "2026-05-06", name: "振替休日" },
  { date: "2026-07-20", name: "海の日" },
  { date: "2026-08-11", name: "山の日" },
  { date: "2026-09-21", name: "敬老の日" },
  { date: "2026-09-22", name: "秋分の日" },
  { date: "2026-09-23", name: "国民の休日" },
  { date: "2026-10-12", name: "スポーツの日" },
  { date: "2026-11-03", name: "文化の日" },
  { date: "2026-11-23", name: "勤労感謝の日" },
];

// 年ごとの祝日を取得（現在は2026年のみ）
export function getNationalHolidays(year: number): HolidayEntry[] {
  if (year === 2026) return NATIONAL_HOLIDAYS_2026;
  // 他の年は空配列（必要に応じて追加）
  return [];
}
