import { describe, expect, it } from "vitest";
import {
  DRIVE_FILE_SCOPE,
  MAX_ATTACHMENT_BYTES,
  attachmentKind,
  formatBytes,
  hasDriveScope,
  isAttachmentFileFor,
  parseAttachmentInit,
} from "./attachments";

describe("parseAttachmentInit（添付の受け付け前の確認）", () => {
  it("正しい入力のとき、名前の前後の空白を除いて返す", () => {
    expect(parseAttachmentInit({ name: "  見積書.pdf ", mimeType: "application/pdf", size: 1200 })).toEqual({
      ok: true,
      data: { name: "見積書.pdf", mimeType: "application/pdf", size: 1200 },
    });
  });

  it("種類が分からないとき、汎用の種類にする", () => {
    expect(parseAttachmentInit({ name: "memo", mimeType: "", size: 10 })).toEqual({
      ok: true,
      data: { name: "memo", mimeType: "application/octet-stream", size: 10 },
    });
  });

  it("名前に改行などの制御文字があるとき、取り除く", () => {
    expect(parseAttachmentInit({ name: "a\nb\t.txt", mimeType: "text/plain", size: 1 })).toMatchObject({
      ok: true,
      data: { name: "ab.txt" },
    });
  });

  it.each([
    ["入力が無い", null, "添付するファイルの情報が正しくありません"],
    ["名前が無い", { name: "  ", mimeType: "text/plain", size: 1 }, "ファイル名がありません"],
    ["名前が長すぎる", { name: "あ".repeat(256), mimeType: "text/plain", size: 1 }, "ファイル名は255文字以内にしてください"],
    ["空のファイル", { name: "a.txt", mimeType: "text/plain", size: 0 }, "空のファイルは添付できません"],
    ["大きすぎる", { name: "a.mp4", mimeType: "video/mp4", size: MAX_ATTACHMENT_BYTES + 1 }, "添付できるのは1ファイル100MBまでです"],
    ["大きさが数でない", { name: "a.txt", mimeType: "text/plain", size: "10" }, "添付するファイルの情報が正しくありません"],
  ])("%s のとき、エラーを返す", (_name, body, message) => {
    expect(parseAttachmentInit(body)).toEqual({ ok: false, error: message });
  });
});

describe("hasDriveScope（Google ドライブの権限があるか）", () => {
  it("権限の一覧にドライブ（アプリが作ったファイルだけ）が含まれるとき true", () => {
    expect(hasDriveScope(`openid email ${DRIVE_FILE_SCOPE} https://www.googleapis.com/auth/calendar.app.created`)).toBe(true);
  });
  it("含まれない・不明なとき false", () => {
    expect(hasDriveScope("openid email https://www.googleapis.com/auth/calendar.app.created")).toBe(false);
    expect(hasDriveScope(null)).toBe(false);
  });
});

describe("isAttachmentFileFor（アップロードされたファイルが、そのタスク用のものか）", () => {
  const file = { id: "f1", parents: ["folder1"], appProperties: { nodePortalTaskId: "t1" }, trashed: false };
  it("専用フォルダにあり、同じタスクの印がついているとき true", () => {
    expect(isAttachmentFileFor(file, { taskId: "t1", folderId: "folder1" })).toBe(true);
  });
  it("別のタスクの印・別のフォルダ・ごみ箱・印なしのとき false", () => {
    expect(isAttachmentFileFor(file, { taskId: "t2", folderId: "folder1" })).toBe(false);
    expect(isAttachmentFileFor(file, { taskId: "t1", folderId: "other" })).toBe(false);
    expect(isAttachmentFileFor({ ...file, trashed: true }, { taskId: "t1", folderId: "folder1" })).toBe(false);
    expect(isAttachmentFileFor({ ...file, appProperties: undefined }, { taskId: "t1", folderId: "folder1" })).toBe(false);
  });
});

describe("attachmentKind（アイコンの種類）", () => {
  it.each([
    ["application/pdf", "a.pdf", "pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx", "word"],
    ["application/msword", "a.doc", "word"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx", "excel"],
    ["text/csv", "a.csv", "excel"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "a.pptx", "slide"],
    ["image/png", "a.png", "image"],
    ["text/plain", "a.txt", "text"],
    ["text/markdown", "a.md", "text"],
    ["application/octet-stream", "a.xlsx", "excel"],
    ["application/zip", "a.zip", "other"],
  ])("%s（%s）は %s", (mime, name, kind) => {
    expect(attachmentKind(mime, name)).toBe(kind);
  });
});

describe("formatBytes（ファイルの大きさの表示）", () => {
  it.each([
    [500, "500B"],
    [1536, "1.5KB"],
    [10 * 1024 * 1024, "10MB"],
    [2.25 * 1024 * 1024, "2.3MB"],
  ])("%d は %s", (n, text) => {
    expect(formatBytes(n)).toBe(text);
  });
});
