import { describe, expect, it } from "vitest";
import {
  appendToSection,
  buildProjectNote,
  encodeContentsPath,
  noteFileName,
  parseNotePath,
} from "./obsidian-note";

describe("parseNotePath（ノートのパスの検証）", () => {
  it.each([
    ["00_node/メモ.md", "00_node/メモ.md"],
    ["08_打ち合わせ.md", "08_打ち合わせ.md"],
    ["01_YeLL/打合せ/20261005.md", "01_YeLL/打合せ/20261005.md"],
    [" 00_node/メモ.md ", "00_node/メモ.md"], // 前後の空白は取り除く
  ])("%s のとき、%s を受け付ける", (input, expected) => {
    expect(parseNotePath(input)).toEqual({ ok: true, path: expected });
  });

  it.each([
    ["空", ""],
    ["文字列でない", 123],
    ["親フォルダへ出る（..）", "../secret.md"],
    ["途中に .. を含む", "00_node/../../etc/passwd.md"],
    ["絶対パス", "/etc/passwd.md"],
    ["Windows 形式の区切り", "00_node\\メモ.md"],
    [".md 以外", "00_node/画像.png"],
    ["拡張子なし", "00_node/メモ"],
    ["Git の管理領域（.git）", ".git/config.md"],
    ["途中の . で始まるフォルダ（.obsidian 等）", "00_node/.obsidian/app.md"],
    [". で始まるファイル", ".gitignore.md"],
    ["制御文字を含む", "00_node/メモ\n.md"],
    ["長すぎる", "あ".repeat(300) + ".md"],
    ["フォルダの区切りが連続", "00_node//メモ.md"],
  ])("%s のとき、拒否する", (_name, input) => {
    expect(parseNotePath(input as string).ok).toBe(false);
  });
});

describe("noteFileName（プロジェクト名からファイル名を作る）", () => {
  it("使えない文字を取り除く", () => {
    expect(noteFileName('見積/作成: "A案"?')).toBe("見積作成 A案.md");
  });
  it("前後の空白・ドットを取り除き、連続する空白を1つにする", () => {
    expect(noteFileName("  ..node   portal.. ")).toBe("node portal.md");
  });
  it("すべて除かれて空になるとき、既定の名前を使う", () => {
    expect(noteFileName("///")).toBe("プロジェクト.md");
  });
  it("長い名前は80文字に切る", () => {
    expect(noteFileName("あ".repeat(120)).length).toBe(80 + ".md".length);
  });
});

describe("encodeContentsPath（API のパス用に符号化）", () => {
  it("日本語・空白を含むパスを区切りごとに符号化する", () => {
    expect(encodeContentsPath("00_node/メモ 1.md")).toBe("00_node/%E3%83%A1%E3%83%A2%201.md");
  });
});

describe("buildProjectNote（プロジェクト用ノートの雛形）", () => {
  it("プロジェクト名・状態・ログの見出しを含む", () => {
    const note = buildProjectNote({ name: "node-portal 開発", status: "active", description: "社内ポータル", dueDate: "2026-12-31" });
    expect(note).toContain("# node-portal 開発");
    expect(note).toContain("状態: 進行中");
    expect(note).toContain("期限: 2026-12-31");
    expect(note).toContain("社内ポータル");
    expect(note).toContain("## ログ");
    expect(note.endsWith("\n")).toBe(true);
  });
  it("説明・期限が無いとき、その行を出さない", () => {
    const note = buildProjectNote({ name: "経理", status: "on_hold", description: null, dueDate: null });
    expect(note).not.toContain("期限:");
    expect(note).toContain("状態: 保留");
  });
});

describe("appendToSection（見出しの下に1行追記）", () => {
  const line = "- 2026-10-06 10:00 見積を送付";

  it("見出しがあるとき、その節の末尾に追記する", () => {
    const before = "# P\n\n## ログ\n- 2026-10-05 開始\n\n## 参考\n- リンク\n";
    expect(appendToSection(before, "ログ", line)).toBe(
      "# P\n\n## ログ\n- 2026-10-05 開始\n" + line + "\n\n## 参考\n- リンク\n"
    );
  });
  it("見出しが最後の節のとき、ファイルの末尾に追記する", () => {
    expect(appendToSection("# P\n\n## ログ\n- a\n", "ログ", line)).toBe("# P\n\n## ログ\n- a\n" + line + "\n");
  });
  it("見出しが無いとき、末尾に見出しごと追加する", () => {
    expect(appendToSection("# P\n本文\n", "ログ", line)).toBe("# P\n本文\n\n## ログ\n" + line + "\n");
  });
  it("末尾に改行が無いファイルでも、行が混ざらない", () => {
    expect(appendToSection("# P\n\n## ログ\n- a", "ログ", line)).toBe("# P\n\n## ログ\n- a\n" + line + "\n");
  });
  it("コードブロックの中の「## ログ」は見出しとして扱わない", () => {
    const before = "# P\n```\n## ログ\n```\n";
    expect(appendToSection(before, "ログ", line)).toBe(before + "\n## ログ\n" + line + "\n");
  });
  it("追記する行に改行が含まれるとき、1行にまとめる（見出しの注入を防ぐ）", () => {
    expect(appendToSection("## ログ\n", "ログ", "a\n## 偽の見出し")).toBe("## ログ\na ## 偽の見出し\n");
  });
});
