import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// クライアントで抽出したPDFテキストを受け取り、企業情報を抽出
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // OCRの改行やスペースのゆらぎを正規化
    const normalized = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    const result: Record<string, string> = {};

    // 会社名（商号） — OCR誤認識対応で複数パターン
    const namePatterns = [
      /商\s*号\s*[:\s]?\s*(.+)/,
      /会社法人等番号[\s\S]*?商\s*号\s*(.+)/,
      /(?:合同会社|株式会社|合資会社|合名会社|有限会社)[^\n]*/,
    ];
    for (const p of namePatterns) {
      const m = normalized.match(p);
      if (m) {
        let name = (m[1] || m[0]).trim();
        name = name.replace(/\s+/g, "").replace(/[（(].*$/, "");
        if (name.length > 1 && name.length < 50) {
          result.name = name;
          break;
        }
      }
    }

    // 所在地（本店）
    const addrPatterns = [
      /本\s*店\s*[:\s]?\s*(.+)/,
      /主たる事務所\s*[:\s]?\s*(.+)/,
      /(?:福岡|東京|大阪|北海道|愛知|神奈川|埼玉|千葉|兵庫|京都|広島|宮城|静岡|茨城|栃木|群馬|岐阜|三重|滋賀|奈良|和歌山|鳥取|島根|岡山|山口|徳島|香川|愛媛|高知|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄|青森|岩手|秋田|山形|福島|新潟|富山|石川|福井|山梨|長野|岐阜|奈良)[都道府県].+?[番号丁目]\s*.*?号/,
    ];
    for (const p of addrPatterns) {
      const m = normalized.match(p);
      if (m) {
        let addr = (m[1] || m[0]).trim();
        addr = addr.split(/\n/)[0].trim();
        if (addr.length > 5) {
          result.address = addr;
          break;
        }
      }
    }

    // 設立日（成立年月日）— 和暦・西暦の両方に対応
    const datePatterns = [
      /(?:成立|設立)(?:年月日|の年月日)?\s*[:\s]?\s*((?:令和|平成|昭和)\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/,
      /(?:令和|平成|昭和)\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日\s*(?:成立|設立|登記)/,
      /((?:令和|平成|昭和)\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/,
    ];
    for (const p of datePatterns) {
      const m = normalized.match(p);
      if (m) {
        const dateStr = (m[1] || m[0]).trim();
        const converted = convertJapaneseDate(dateStr);
        if (converted) {
          result.establishedDate = converted;
          break;
        }
      }
    }

    // 法人番号 — 12〜13桁の数字
    const corpPatterns = [
      /法人番号\s*[:\s]?\s*(\d[\d\s-]{10,14}\d)/,
      /会社法人等番号\s*[:\s]?\s*(\d[\d\s-]{8,14}\d)/,
    ];
    for (const p of corpPatterns) {
      const m = normalized.match(p);
      if (m) {
        result.corporateNumber = m[1].replace(/[\s-]/g, "");
        break;
      }
    }

    // 代表者
    const repPatterns = [
      /(?:代表社員|代表取締役|業務執行社員)\s*[:\s]?\s*(.+)/,
      /(?:代表社員|代表取締役)\s*\n\s*(.+)/,
    ];
    for (const p of repPatterns) {
      const m = normalized.match(p);
      if (m) {
        let rep = m[1].trim();
        rep = rep.replace(/^(業務執行社員|社員)\s*/, "");
        rep = rep.split(/[\s\n]{2,}/)[0].trim();
        rep = rep.replace(/[住所届届出sinc sinceれ及び]*$/, "").trim();
        if (rep.length >= 2 && rep.length < 20) {
          result.representativeName = rep;
          break;
        }
      }
    }

    // 事業内容（目的）
    const purposePatterns = [
      /目\s*的\s*[:\s]?\s*([\s\S]*?)(?=\n\s*(?:資本|社員|取締|本店|商号|発行|公告|登記|代表))/,
      /目\s*的\s*[:\s]?\s*([\s\S]{10,500})/,
    ];
    for (const p of purposePatterns) {
      const m = normalized.match(p);
      if (m) {
        const purposes = m[1]
          .split(/\n/)
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 1 && !l.match(/^\d+\s*$/))
          .join("、");
        if (purposes.length > 5) {
          result.businessType = purposes.slice(0, 500);
          break;
        }
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
