"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useAuth } from "@/lib/auth-context";
import { canWriteFaqDocuments } from "@/lib/permissions";

// FAQ書類の一覧表示＋（管理者のみ）アップロード・削除
// 従業員・社労士・管理者の全ロールが閲覧可能

type FaqDocumentMeta = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
};

type FaqDocumentFull = FaqDocumentMeta & {
  dataBase64: string;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const inputClass =
  "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

// バイトを「KB / MB」表記に
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// File を Base64 文字列に変換
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:application/pdf;base64,xxxxx の xxxxx 部分だけ取り出す
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function FaqList() {
  const { user } = useAuth();
  const canWrite = canWriteFaqDocuments(user?.role);

  const [documents, setDocuments] = useState<FaqDocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // アップロードフォーム
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // プレビューモーダル
  const [previewDoc, setPreviewDoc] = useState<FaqDocumentFull | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchList = useCallback(() => {
    const url = selectedCategory
      ? `/api/faq-documents?category=${encodeURIComponent(selectedCategory)}`
      : "/api/faq-documents";
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setDocuments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // アップロード実行
  const handleUpload = async () => {
    setFormMsg(null);
    if (!file) {
      setFormMsg({ type: "err", text: "PDFファイルを選択してください" });
      return;
    }
    if (!title.trim()) {
      setFormMsg({ type: "err", text: "タイトルを入力してください" });
      return;
    }
    if (file.type !== "application/pdf") {
      setFormMsg({ type: "err", text: "PDFファイルのみアップロード可能です" });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormMsg({ type: "err", text: "ファイルサイズは10MB以下にしてください" });
      return;
    }

    setUploading(true);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await fetch("/api/faq-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          dataBase64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormMsg({ type: "err", text: data.error || "アップロードに失敗しました" });
        return;
      }
      setFormMsg({ type: "ok", text: "アップロードしました" });
      setFile(null);
      setTitle("");
      setCategory("");
      setDescription("");
      setShowForm(false);
      fetchList();
    } catch {
      setFormMsg({ type: "err", text: "ファイルの読み込みに失敗しました" });
    } finally {
      setUploading(false);
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm("この書類を削除しますか？")) return;
    const res = await fetch(`/api/faq-documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchList();
    }
  };

  // プレビュー
  const openPreview = async (id: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/faq-documents/${id}`);
      if (!res.ok) return;
      const data: FaqDocumentFull = await res.json();
      setPreviewDoc(data);
    } finally {
      setPreviewLoading(false);
    }
  };

  // カテゴリ一覧（フィルタ用・ユニーク化）
  const categories = Array.from(
    new Set(documents.map((d) => d.category).filter((c): c is string => !!c))
  );

  if (loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">FAQ</div>
        {canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-5 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
          >
            {showForm ? "閉じる" : "+ 書類を追加"}
          </button>
        )}
      </div>

      {!canWrite && documents.length === 0 && (
        <Card className="text-center !py-10 text-app-sub">
          FAQ書類がまだ登録されていません
        </Card>
      )}

      {/* アップロードフォーム（admin のみ） */}
      {canWrite && showForm && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">書類を追加</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelClass}>PDFファイル（10MB以下）</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm text-app-sub"
              />
              {file && (
                <div className="text-[11px] text-app-sub mt-1">
                  {file.name} ({formatFileSize(file.size)})
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="例: 就業規則 2026年版"
              />
            </div>
            <div>
              <label className={labelClass}>カテゴリ</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
                placeholder="例: 就業規則 / 給与規程 / その他"
              />
            </div>
            <div>
              <label className={labelClass}>説明</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} min-h-[60px] resize-y`}
                rows={2}
                placeholder="補足説明（任意）"
              />
            </div>

            {formMsg && (
              <div
                className={`text-sm rounded p-3 text-center ${
                  formMsg.type === "ok"
                    ? "text-primary-dark bg-primary-light"
                    : "text-danger bg-danger-light"
                }`}
              >
                {formMsg.text}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {uploading ? "アップロード中..." : "アップロードする"}
            </button>
          </div>
        </Card>
      )}

      {/* カテゴリフィルタ（ドキュメントがある時のみ） */}
      {categories.length > 0 && (
        <Card className="!p-3">
          <label className={labelClass}>カテゴリで絞り込み</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">すべて</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Card>
      )}

      {/* 書類一覧 */}
      {documents.length === 0 && canWrite ? (
        <Card className="text-center !py-10 text-app-sub">
          まだ書類が登録されていません。「+ 書類を追加」から登録してください。
        </Card>
      ) : (
        documents.map((doc) => (
          <Card key={doc.id} className="!p-4">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-app-text">{doc.title}</div>
                {doc.category && (
                  <div className="mt-1">
                    <Badge type="accent">{doc.category}</Badge>
                  </div>
                )}
                {doc.description && (
                  <div className="text-xs text-app-sub mt-1.5 whitespace-pre-wrap">
                    {doc.description}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[11px] text-app-sub mb-3">
              {doc.fileName} ・ {formatFileSize(doc.fileSize)} ・{" "}
              {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openPreview(doc.id)}
                disabled={previewLoading}
                className="flex-1 px-4 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
              >
                閲覧
              </button>
              {canWrite && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-4 py-2.5 rounded border border-danger text-danger text-sm font-semibold bg-transparent cursor-pointer"
                >
                  削除
                </button>
              )}
            </div>
          </Card>
        ))
      )}

      {/* PDFプレビューモーダル */}
      {previewDoc && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={() => setPreviewDoc(null)}
          />
          <div className="fixed inset-x-4 top-[5%] bottom-[5%] bg-white rounded z-[300] shadow-lg flex flex-col max-w-app mx-auto">
            <div className="bg-white border-b border-app-border p-4 flex items-center justify-between shrink-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-app-text truncate">{previewDoc.title}</div>
                <div className="text-[11px] text-app-sub truncate">{previewDoc.fileName}</div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <a
                  href={`data:${previewDoc.mimeType};base64,${previewDoc.dataBase64}`}
                  download={previewDoc.fileName}
                  className="px-3 py-1.5 rounded bg-primary text-white text-xs font-bold no-underline"
                >
                  DL
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="w-8 h-8 flex items-center justify-center rounded text-app-sub hover:bg-gray-100 border-none bg-transparent cursor-pointer text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={`data:${previewDoc.mimeType};base64,${previewDoc.dataBase64}`}
                className="w-full h-full border-0"
                title={previewDoc.title}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
