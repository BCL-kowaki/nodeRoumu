import { describe, expect, it } from "vitest";
import { extractUrls, splitLinks } from "./linkify";

describe("splitLinks（文章の中の URL をリンクにする）", () => {
  it("URL の前後の文章と URL に分ける", () => {
    expect(splitLinks("見る: https://github.com/orgs/x/projects/3 です")).toEqual([
      { type: "text", value: "見る: " },
      { type: "link", value: "https://github.com/orgs/x/projects/3" },
      { type: "text", value: " です" },
    ]);
  });
  it("文末の句読点・閉じかっこ・バッククォートは URL に含めない", () => {
    expect(splitLinks("(https://example.com/a)。")).toEqual([
      { type: "text", value: "(" },
      { type: "link", value: "https://example.com/a" },
      { type: "text", value: ")。" },
    ]);
    expect(splitLinks("`https://example.com/b`")).toEqual([
      { type: "text", value: "`" },
      { type: "link", value: "https://example.com/b" },
      { type: "text", value: "`" },
    ]);
  });
  it("日本語が続いても、URL はその手前で区切る", () => {
    expect(splitLinks("https://example.com/c参照")).toEqual([
      { type: "link", value: "https://example.com/c" },
      { type: "text", value: "参照" },
    ]);
  });
  it("http(s) 以外（javascript: など）はリンクにしない", () => {
    expect(splitLinks("javascript:alert(1) ftp://x")).toEqual([{ type: "text", value: "javascript:alert(1) ftp://x" }]);
  });
  it("URL が無いときは、文章ひとつ", () => {
    expect(splitLinks("メモ")).toEqual([{ type: "text", value: "メモ" }]);
  });
});

describe("extractUrls（文章の中の URL を重複なく取り出す）", () => {
  it("出てきた順に、重複を除いて返す", () => {
    expect(extractUrls("https://a.example/1 と https://b.example と https://a.example/1")).toEqual([
      "https://a.example/1",
      "https://b.example",
    ]);
  });
});
