import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// クライアントで抽出したPDFテキストを受け取り、正規表現で企業情報を抽出
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    const result: Record<string, string> = {};

    // 会社名（商号）
    const nameMatch = text.match(/商\s*号\s*[:\s]*(.+)/);
    if (nameMatch) result.name = nameMatch[1].trim();

    // 所在地（本店）
    const addressMatch = text.match(/本\s*店\s*[:\s]*(.+)/);
    if (addressMatch) result.address = addressMatch[1].trim();

    // 設立日（成立年月日）
    const estMatch = text.match(/(?:成立|設立)(?:年月日|の年月日)?\s*[:\s]*((?:令和|平成|昭和)?\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/);
    if (estMatch) {
      result.establishedDate = convertJapaneseDate(estMatch[1].trim());
    }

    // 法人番号
    const corpMatch = text.match(/法人番号\s*[:\s]*(\d[\d\s-]*\d)/);
    if (corpMatch) result.corporateNumber = corpMatch[1].replace(/[\s-]/g, "");

    // 代表者
    const repMatch = text.match(/(?:代表社員|代表取締役|代表者)\s*[:\s]*(.+)/);
    if (repMatch) {
      let rep = repMatch[1].trim();
      rep = rep.replace(/^(業務執行社員|社員)\s*/, "");
      result.representativeName = rep.split(/\s{2,}|\n/)[0].trim();
    }

    // 事業内容（目的）
    const purposeMatch = text.match(/目\s*的\s*[:\s]*([\s\S]*?)(?=\n\s*(?:資本|社員|取締|本店|商号|発行|公告|登記))/);
    if (purposeMatch) {
      const purposes = purposeMatch[1]
        .split(/\n/)
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.match(/^\d+\s*$/))
        .join("、");
      result.businessType = purposes;
    }

    return NextResponse.json({ ok: true, extracted: result });
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
