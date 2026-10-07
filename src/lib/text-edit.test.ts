import { describe, expect, it } from "vitest";
import { insertLink, isLinkableUrl, prefixLines, wrapSelection } from "./text-edit";

describe("insertLink（選んだ文字をテキストリンクにする）", () => {
  it("選んだ文字を表示名にして [表示名](URL) にする", () => {
    expect(insertLink("詳細は提案ページを参照", 3, 8, "https://example.com/a")).toEqual({
      value: "詳細は[提案ページ](https://example.com/a)を参照",
      cursor: 3 + "[提案ページ](https://example.com/a)".length,
    });
  });
  it("何も選んでいないときは、URL を表示名にして入れる（あとで書き換えられる）", () => {
    expect(insertLink("見る: ", 4, 4, "https://example.com")).toMatchObject({ value: "見る: [https://example.com](https://example.com)" });
  });
  it("表示名に ] や改行があるときは取り除く", () => {
    expect(insertLink("a]b\nc", 0, 5, "https://x.jp").value).toBe("[ab c](https://x.jp)");
  });
});

describe("isLinkableUrl（リンクにできる URL か）", () => {
  it("http / https だけ", () => {
    expect(isLinkableUrl(" https://example.com/x ")).toBe(true);
    expect(isLinkableUrl("http://a.b")).toBe(true);
    expect(isLinkableUrl("javascript:alert(1)")).toBe(false);
    expect(isLinkableUrl("example.com")).toBe(false);
    expect(isLinkableUrl("https://a.b c")).toBe(false);
  });
});

describe("wrapSelection（太字など、選んだ文字を記号で囲む）", () => {
  it("選んだ文字を ** で囲む", () => {
    expect(wrapSelection("重要なこと", 0, 2, "**")).toEqual({ value: "**重要**なこと", selStart: 2, selEnd: 4 });
  });
  it("すでに囲まれていれば外す", () => {
    expect(wrapSelection("**重要**なこと", 2, 4, "**")).toEqual({ value: "重要なこと", selStart: 0, selEnd: 2 });
  });
});

describe("prefixLines（箇条書き・チェックボックスの付け外し）", () => {
  it("選んだ行の先頭に付ける（空行は除く）", () => {
    expect(prefixLines("a\n\nb", 0, 4, "- ").value).toBe("- a\n\n- b");
  });
  it("すべての行に付いていれば外す", () => {
    expect(prefixLines("- a\n- b", 0, 7, "- ").value).toBe("a\nb");
  });
  it("カーソルだけのときは、その行に付ける", () => {
    expect(prefixLines("x\ny", 3, 3, "- [ ] ").value).toBe("x\n- [ ] y");
  });
});
