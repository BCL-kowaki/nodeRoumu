import { describe, expect, it } from "vitest";
import { buildMinutesNote, buildNoteTree, isInFolder, linkWikiLinks, newNotePath, parseEntryName, projectFolderFor } from "./obsidian-tree";

describe("projectFolderFor（プロジェクト専用フォルダの場所）", () => {
  it("紐づいたノートがあれば、その名前のフォルダ（ノートの隣）", () => {
    expect(projectFolderFor("Projects/田村ビルズ様_研修.md", "どれでも")).toBe("Projects/田村ビルズ様_研修");
  });
  it("ノートが無ければ Projects/プロジェクト名（ファイル名に使えない文字は除く）", () => {
    expect(projectFolderFor(null, "SFA/CRM構築")).toBe("Projects/SFACRM構築");
  });
});

describe("isInFolder（フォルダの中のパスか）", () => {
  it("フォルダの中だけ true（前方一致の別フォルダは false）", () => {
    expect(isInFolder("Projects/A/議事録/x.md", "Projects/A")).toBe(true);
    expect(isInFolder("Projects/AB/x.md", "Projects/A")).toBe(false);
    expect(isInFolder("Projects/A.md", "Projects/A")).toBe(false);
  });
});

describe("parseEntryName（フォルダ名・ノート名）", () => {
  it("前後の空白を除き、使えない文字を取り除く", () => {
    expect(parseEntryName(" 議事録 ")).toEqual({ ok: true, name: "議事録" });
    expect(parseEntryName("a/b:c")).toEqual({ ok: true, name: "abc" });
  });
  it("空・. で始まる・長すぎるときはエラー", () => {
    expect(parseEntryName("  ")).toEqual({ ok: false, error: "名前を入力してください" });
    expect(parseEntryName(".hidden")).toEqual({ ok: false, error: "名前を「.」で始めることはできません" });
    expect(parseEntryName("あ".repeat(81))).toEqual({ ok: false, error: "名前は80文字以内にしてください" });
  });
});

describe("newNotePath（新しいノートのパス）", () => {
  it("フォルダの下に .md を付けて作る。議事録は日付を先頭に付ける", () => {
    expect(newNotePath("Projects/A", "メモ", "blank", "2026-10-07")).toBe("Projects/A/メモ.md");
    expect(newNotePath("Projects/A/議事録", "定例", "minutes", "2026-10-07")).toBe("Projects/A/議事録/2026-10-07_定例.md");
  });
});

describe("buildNoteTree（フォルダとノートの一覧を木の形に）", () => {
  it("フォルダを先、名前順に並べ、空のフォルダ（.gitkeep だけ）も出す。.md 以外は出さない", () => {
    const tree = buildNoteTree(
      ["Projects/A/議事録/2026-10-07_定例.md", "Projects/A/メモ.md", "Projects/A/資料/.gitkeep", "Projects/A/画像.png", "Projects/A/議事録/2026-10-01_初回.md"],
      "Projects/A"
    );
    expect(tree).toEqual([
      {
        type: "folder",
        name: "議事録",
        path: "Projects/A/議事録",
        children: [
          { type: "note", name: "2026-10-01_初回", path: "Projects/A/議事録/2026-10-01_初回.md" },
          { type: "note", name: "2026-10-07_定例", path: "Projects/A/議事録/2026-10-07_定例.md" },
        ],
      },
      { type: "folder", name: "資料", path: "Projects/A/資料", children: [] },
      { type: "note", name: "メモ", path: "Projects/A/メモ.md" },
    ]);
  });
});

describe("buildMinutesNote（議事録のひな形）", () => {
  it("タイトル・日付・プロジェクトのノートへのリンクと、決まった見出しを入れる", () => {
    const t = buildMinutesNote({ title: "定例", date: "2026-10-07", projectNotePath: "Projects/A.md", projectName: "A" });
    expect(t).toContain("# 定例");
    expect(t).toContain("- 日付: 2026-10-07");
    expect(t).toContain("- プロジェクト: [[Projects/A|A]]");
    for (const h of ["## 参加者", "## 議題", "## 内容", "## 決定事項", "## TODO"]) expect(t).toContain(h);
  });
});

describe("linkWikiLinks（Obsidian の [[リンク]] を画面のリンクにする）", () => {
  it("[[パス|表示名]] と [[パス]] を、アプリ内で開くリンクに置き換える", () => {
    expect(linkWikiLinks("見る: [[Projects/A|A]] と [[Projects/A/メモ]]")).toBe(
      "見る: [A](obsidian:Projects%2FA.md) と [メモ](obsidian:Projects%2FA%2F%E3%83%A1%E3%83%A2.md)"
    );
  });
  it("コードの中はそのまま", () => {
    expect(linkWikiLinks("`[[x]]`")).toBe("`[[x]]`");
  });
});
