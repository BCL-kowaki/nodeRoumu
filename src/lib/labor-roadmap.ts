// 年間労務ロードマップ — 日本の労務管理における主要イベント

export type LaborEvent = {
  month: number;        // 1-12（0=通年）
  day?: number;         // 期限日（任意）
  title: string;        // イベント名
  description: string;  // 詳細説明
  category: "tax" | "insurance" | "labor" | "wage" | "general";
  deadline?: string;    // 期限表記（例: "1/31まで"）
};

export const LABOR_ROADMAP: LaborEvent[] = [
  // 1月
  { month: 1, day: 31, title: "法定調書の提出", description: "支払調書・源泉徴収票等の法定調書を税務署に提出", category: "tax", deadline: "1/31まで" },
  { month: 1, day: 31, title: "給与支払報告書提出", description: "前年分の給与支払報告書を各市区町村に提出", category: "tax", deadline: "1/31まで" },
  // 3月
  { month: 3, title: "36協定届の確認・更新", description: "時間外・休日労働に関する協定の有効期限を確認", category: "labor" },
  // 4月
  { month: 4, title: "健康保険・厚生年金料率改定", description: "新年度の保険料率を確認し、料率設定画面を更新", category: "insurance" },
  { month: 4, title: "雇用保険料率確認", description: "新年度の雇用保険料率の変更有無を確認", category: "insurance" },
  // 5月
  { month: 5, title: "住民税特別徴収額の通知対応", description: "市区町村から届く特別徴収税額通知の確認・反映", category: "tax" },
  // 6月
  { month: 6, title: "住民税額改定", description: "新年度の住民税額を賃金台帳に反映", category: "tax" },
  { month: 6, title: "労働保険年度更新準備", description: "前年度の賃金集計と申告書の準備", category: "insurance" },
  // 7月
  { month: 7, day: 10, title: "社会保険算定基礎届", description: "4〜6月の報酬をもとに標準報酬月額を届出", category: "insurance", deadline: "7/10まで" },
  { month: 7, day: 10, title: "労働保険年度更新", description: "労働保険料の年度更新申告・納付", category: "insurance", deadline: "7/10まで" },
  // 9月
  { month: 9, title: "社会保険料率改定", description: "算定基礎届に基づく標準報酬月額の反映", category: "insurance" },
  // 10月
  { month: 10, title: "最低賃金改定確認", description: "地域別最低賃金の改定を確認し、時給を見直し", category: "wage" },
  // 11月
  { month: 11, title: "年末調整準備開始", description: "従業員へ扶養控除等申告書の配布・回収", category: "tax" },
  // 12月
  { month: 12, title: "年末調整実施", description: "所得税の過不足精算を実施", category: "tax" },
  { month: 12, title: "賞与支払届", description: "賞与支給時は年金事務所へ届出（該当月）", category: "insurance" },
  // 通年
  { month: 0, title: "入退社手続き", description: "社会保険・雇用保険の資格取得届・喪失届", category: "general" },
  { month: 0, title: "36協定管理", description: "時間外労働の上限管理と協定の遵守確認", category: "labor" },
  { month: 0, title: "有給休暇管理", description: "年次有給休暇の付与・取得状況の管理", category: "labor" },
];

// カテゴリ色
export function categoryColor(cat: string): string {
  switch (cat) {
    case "tax": return "bg-blue-400";
    case "insurance": return "bg-primary";
    case "labor": return "bg-orange-400";
    case "wage": return "bg-purple-400";
    default: return "bg-gray-400";
  }
}

// カテゴリ名
export function categoryLabel(cat: string): string {
  switch (cat) {
    case "tax": return "税務";
    case "insurance": return "社会保険";
    case "labor": return "労務";
    case "wage": return "賃金";
    default: return "一般";
  }
}
