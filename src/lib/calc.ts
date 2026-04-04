// 社会保険料の計算ロジック

export type RateValues = {
  healthInsurance: number; // 健康保険料率（%）— 労使合計
  pension: number;         // 厚生年金保険料率（%）— 労使合計
  employmentInsurance: number; // 雇用保険料率（%）— 労働者負担分
};

export type DeductionResult = {
  healthInsurance: number;
  pension: number;
  employmentInsurance: number;
  totalSocial: number;
};

/**
 * 社会保険料を計算する
 * 健康保険・厚生年金は労使折半（÷2）
 * 雇用保険は労働者負担分のみ
 */
export function calcDeductions(totalPay: number, rates: RateValues): DeductionResult {
  const healthInsurance = Math.round((totalPay * rates.healthInsurance) / 100 / 2);
  const pension = Math.round((totalPay * rates.pension) / 100 / 2);
  const employmentInsurance = Math.round((totalPay * rates.employmentInsurance) / 100);
  return {
    healthInsurance,
    pension,
    employmentInsurance,
    totalSocial: healthInsurance + pension + employmentInsurance,
  };
}

/**
 * 実働時間を計算する（分単位 → 時間）
 */
export function calcWorkHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes;
  return totalMinutes > 0 ? totalMinutes / 60 : 0;
}
