import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 日本語文字間のOCRスペースを除去する
// 「合 同 会 社 node」→「合同会社node」
// 「福 岡 市 中 央 区」→「福岡市中央区」
// ただし英数字同士のスペースは保持
function removeOcrSpaces(text: string): string {
  return text.replace(
    /([\u3000-\u9FFF\uF900-\uFAFF])\s+([\u3000-\u9FFF\uF900-\uFAFF])/g,
    "$1$2"
  );
}

// 複数回適用（「合 同 会 社」→1回で「合同 会社」→2回で「合同会社」）
function cleanOcrText(text: string): string {
  let prev = text;
  for (let i = 0; i < 5; i++) {
    const cleaned = removeOcrSpaces(prev);
    if (cleaned === prev) break;
    prev = cleaned;
  }
  // 数字間のスペースも除去（「1 4 番」→「14番」）
  prev = prev.replace(/(\d)\s+(\d)/g, "$1$2");
  // 漢字と数字の間のスペース除去（「令和 8 年」→「令和8年」）
  prev = prev.replace(/([\u3000-\u9FFF])\s+(\d)/g, "$1$2");
  prev = prev.replace(/(\d)\s+([\u3000-\u9FFF])/g, "$1$2");
  return prev;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // OCRテキストの正規化
    const raw = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
    // 行ごとにOCRスペースを除去
    const normalized = raw
      .split("\n")
      .map((line: string) => cleanOcrText(line.trim()))
      .join("\n");

    const result: Record<string, string> = {};

    // 会社名（商号）
    // OCR例: 「合同会社node」
    const nameMatch = normalized.match(/(?:合同会社|株式会社|合資会社|合名会社|有限会社)\s*\S+/);
    if (nameMatch) {
      result.name = nameMatch[0].replace(/\s+/g, "");
    }

    // 所在地
    // OCR例: 「福岡市中央区平尾三丁目14番17ー202号」 or 行頭に都道府県
    const addrMatch = normalized.match(
      /(?:福岡|東京|大阪|北海道|愛知|神奈川|埼玉|千葉|兵庫|京都|広島|宮城|静岡|茨城|栃木|群馬|岐阜|三重|滋賀|奈良|和歌山|鳥取|島根|岡山|山口|徳島|香川|愛媛|高知|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄|青森|岩手|秋田|山形|福島|新潟|富山|石川|福井|山梨|長野)[都道府県市].+?号/
    );
    if (addrMatch) {
      result.address = addrMatch[0].replace(/\s+/g, "");
    }

    // 設立日（成立の年月日）
    // OCR例: 「会社成立の年月日|令和8年3月18日」（|はOCR誤認識の可能性）
    const dateMatch = normalized.match(
      /(?:令和|平成|昭和)\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/
    );
    if (dateMatch) {
      const converted = convertJapaneseDate(dateMatch[0]);
      if (converted) result.establishedDate = converted;
    }

    // 法人番号 / 会社法人等番号
    // OCR例: 「会社法人等番号0900.3に08泊60」（OCR誤認識が激しい）
    // より緩い: 番号の後の連続数字を取得
    const corpMatch = normalized.match(/(?:法人番号|法人等番号)\s*[:\s]?\s*([\d.\s]{4,})/);
    if (corpMatch) {
      const num = corpMatch[1].replace(/[\s.]/g, "");
      if (num.length >= 4) result.corporateNumber = num;
    }

    // 代表者
    // 合同会社の場合: 「代表社員」「業務執行社員」の後に名前
    const repPatterns = [
      /代表社員[^\n]*?([^\s]{2,10})/,
      /代表取締役[^\n]*?([^\s]{2,10})/,
      /業務執行社員[^\n]*?([^\s]{2,10})/,
    ];
    for (const p of repPatterns) {
      const m = normalized.match(p);
      if (m) {
        let name = m[1].trim();
        // 不要な文字を除去
        name = name.replace(/[住所届届出sinceれ及び公告方法資本]/g, "");
        if (name.length >= 2 && name.length <= 10) {
          result.representativeName = name;
          break;
        }
      }
    }

    // 事業内容（目的）
    // 「目的」の後に続くテキスト
    const purposeIdx = normalized.indexOf("目的");
    if (purposeIdx >= 0) {
      const afterPurpose = normalized.slice(purposeIdx + 2, purposeIdx + 600);
      const lines = afterPurpose
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 3);

      // 「資本」「社員」「代表」等が出たらそこで終了
      const endKeywords = ["資本", "社員に", "代表社員", "取締役", "公告", "登記"];
      const purposes: string[] = [];
      for (const line of lines) {
        if (endKeywords.some((kw) => line.includes(kw))) break;
        purposes.push(line);
      }
      if (purposes.length > 0) {
        result.businessType = purposes.join("、").slice(0, 500);
      }
    }

    return NextResponse.json({
      ok: true,
      extracted: result,
      rawText: normalized.slice(0, 3000),
    });
  } catch (error) {
    console.error("テキスト解析エラー:", error);
    return NextResponse.json({ error: "テキストの解析に失敗しました" }, { status: 500 });
  }
}

// 和暦→西暦変換
function convertJapaneseDate(jpDate: string): string {
  let year = 0;
  const yearMatch = jpDate.match(/(令和|平成|昭和)\s*(\d+)\s*年/);
  const monthMatch = jpDate.match(/(\d+)\s*月/);
  const dayMatch = jpDate.match(/(\d+)\s*日/);

  if (yearMatch) {
    const era = yearMatch[1];
    const eraYear = parseInt(yearMatch[2]);
    if (era === "令和") year = 2018 + eraYear;
    else if (era === "平成") year = 1988 + eraYear;
    else if (era === "昭和") year = 1925 + eraYear;
  }

  if (!year || !monthMatch || !dayMatch) return "";
  const month = monthMatch[1].padStart(2, "0");
  const day = dayMatch[1].padStart(2, "0");
  return `${year}-${month}-${day}`;
}
