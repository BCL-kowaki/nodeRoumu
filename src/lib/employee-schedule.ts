// 従業員向け年間労務スケジュール

export type EmployeeEvent = {
  month: number; // 1-12（0=通年）
  title: string;
  description: string;
};

export const EMPLOYEE_SCHEDULE: EmployeeEvent[] = [
  { month: 1, title: "源泉徴収票の受け取り", description: "前年分の源泉徴収票が配布されます。確定申告に必要な場合は保管してください" },
  { month: 5, title: "住民税額の確認", description: "6月から新しい住民税額が適用されます。給与明細で確認してください" },
  { month: 6, title: "住民税の改定", description: "新年度の住民税額が給与から控除されます" },
  { month: 11, title: "年末調整の書類提出", description: "扶養控除等申告書・保険料控除申告書を期日までに提出してください" },
  { month: 12, title: "年末調整の結果確認", description: "12月の給与で所得税の過不足が精算されます。給与明細を確認してください" },
  { month: 0, title: "有給休暇の確認", description: "残日数を確認し、計画的に取得しましょう。年5日以上の取得が義務です" },
  { month: 0, title: "個人情報の変更届", description: "住所・氏名・扶養家族に変更があれば速やかに届け出てください" },
];
