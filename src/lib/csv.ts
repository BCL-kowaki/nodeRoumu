// CSV生成ユーティリティ（RFC 4180準拠）
// 給与台帳などのエクスポート用。外部ライブラリ不使用。

export type CsvValue = string | number | null | undefined;

// 値をCSVセルとしてエスケープ
// カンマ・改行・ダブルクォートを含む場合は全体を"..."で囲み、"は""に置換
export function csvEscape(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ヘッダー行と明細行からCSV文字列を生成
// Excelで日本語が化けないよう、呼び出し側で先頭にBOM (\uFEFF) を付けて返す
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  // Excel互換のためCRLF区切り
  return lines.join("\r\n");
}
