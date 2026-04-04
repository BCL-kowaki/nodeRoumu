"use client";

import { useEffect, useState, useRef } from "react";
import Card from "@/components/Card";

type Company = {
  id: string;
  name: string;
  nameKana: string | null;
  representativeName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  establishedDate: string | null;
  businessType: string | null;
  corporateNumber: string | null;
  memo: string | null;
};

const inputClass = "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function CompanyPage() {
  const [form, setForm] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/company")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          ...data,
          establishedDate: data.establishedDate?.slice(0, 10) || null,
        });
        setLoading(false);
      });
  }, []);

  const doSave = async () => {
    if (!form) return;
    await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // PDFページを画像に変換
  const pageToImage = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any
  ): Promise<string> => {
    const scale = 3; // 高解像度でOCR精度向上
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  };

  // OCRで画像からテキスト抽出
  const ocrFromImages = async (imageDataUrls: string[]): Promise<string> => {
    const Tesseract = await import("tesseract.js");
    let fullText = "";
    for (let i = 0; i < imageDataUrls.length; i++) {
      setUploadMsg(`OCR処理中... (${i + 1}/${imageDataUrls.length}ページ)`);
      const result = await Tesseract.recognize(imageDataUrls[i], "jpn", {
        logger: () => {},
      });
      fullText += result.data.text + "\n";
    }
    return fullText;
  };

  // 結果をフォームに反映
  const applyExtracted = (ext: Record<string, string>) => {
    if (!form) return;
    setForm({
      ...form,
      name: ext.name || form.name,
      address: ext.address || form.address,
      establishedDate: ext.establishedDate || form.establishedDate,
      corporateNumber: ext.corporateNumber || form.corporateNumber,
      representativeName: ext.representativeName || form.representativeName,
      businessType: ext.businessType || form.businessType,
    });
    const count = Object.keys(ext).length;
    setUploadMsg(
      count > 0
        ? `${count}件の情報を読み取りました。内容を確認して保存してください`
        : "情報を読み取れませんでした。手動で入力してください"
    );
  };

  // PDFアップロード処理
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;

    setUploading(true);
    setUploadMsg("PDF解析中...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Step 1: テキストPDFとして読み取りを試みる
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str || "")
          .join(" ");
        fullText += pageText + "\n";
      }

      // Step 2: テキストが取れなければOCR（スキャンPDF対応）
      if (!fullText.trim()) {
        setUploadMsg("スキャンPDFを検出しました。OCR処理を開始します...");
        const images: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const img = await pageToImage(page);
          images.push(img);
        }
        fullText = await ocrFromImages(images);
      }

      if (!fullText.trim()) {
        setUploadMsg("テキストを読み取れませんでした");
        setRawText("（テキスト抽出結果なし）");
        return;
      }

      // Step 3: サーバーで正規表現解析
      setUploadMsg("テキストを解析中...");
      const res = await fetch("/api/company/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadMsg(data.error || "解析に失敗しました");
        return;
      }

      if (data.rawText) setRawText(data.rawText);
      applyExtracted(data.extracted);
    } catch (err) {
      console.error("PDF解析エラー:", err);
      setUploadMsg("PDFの解析中にエラーが発生しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading || !form)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const fields = [
    { k: "name", l: "会社名", t: "text" },
    { k: "nameKana", l: "フリガナ", t: "text" },
    { k: "representativeName", l: "代表者名", t: "text" },
    { k: "address", l: "所在地", t: "text" },
    { k: "phone", l: "電話番号", t: "tel" },
    { k: "email", l: "メールアドレス", t: "email" },
    { k: "establishedDate", l: "設立日", t: "date" },
    { k: "businessType", l: "事業内容", t: "text" },
    { k: "corporateNumber", l: "法人番号", t: "text" },
    { k: "memo", l: "備考", t: "text" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">企業情報</div>

      {saved && (
        <Card className="!bg-primary-light text-center !p-3">
          <div className="text-sm font-bold text-primary-dark">✅ 保存しました</div>
        </Card>
      )}

      {/* 謄本PDFアップロード */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-2">📄 謄本PDFから読み取り</div>
        <div className="text-[11px] text-app-sub mb-3">
          登記簿謄本のPDFをアップロードすると、会社名・所在地・設立日・法人番号・代表者・事業内容を自動入力します。
          スキャンPDFにも対応しています（OCR処理に数十秒かかる場合があります）
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfUpload}
            className="text-xs text-app-sub"
            disabled={uploading}
          />
        </div>
        {uploadMsg && (
          <div className={`text-xs mt-2 p-2.5 rounded ${
            uploadMsg.includes("失敗") || uploadMsg.includes("エラー") || uploadMsg.includes("読み取れません")
              ? "text-danger bg-danger-light"
              : uploading
              ? "text-app-text bg-[#FFF8E1]"
              : "text-primary-dark bg-primary-light"
          }`}>
            {uploading && "⏳ "}{uploadMsg}
          </div>
        )}
        {rawText && !uploading && (
          <div className="mt-2">
            <button
              onClick={() => setShowRawText((v) => !v)}
              className="text-[11px] text-app-sub underline cursor-pointer bg-transparent border-none p-0"
            >
              {showRawText ? "読み取りテキストを閉じる" : "読み取りテキストを確認する"}
            </button>
            {showRawText && (
              <pre className="mt-1 p-2 bg-gray-50 border border-app-border rounded text-[10px] text-app-sub overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                {rawText}
              </pre>
            )}
          </div>
        )}
      </Card>

      {/* 企業情報フォーム */}
      <Card>
        <div className="flex flex-col gap-3.5">
          {fields.map((x) => (
            <div key={x.k}>
              <label className={labelClass}>{x.l}</label>
              <input
                className={inputClass}
                type={x.t}
                value={(form as Record<string, unknown>)[x.k] as string || ""}
                onChange={(e) => setForm({ ...form, [x.k]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <button
          onClick={doSave}
          className="mt-5 px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          保存する
        </button>
      </Card>
    </div>
  );
}
