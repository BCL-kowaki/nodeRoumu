import { describe, expect, it } from "vitest";
import { routineClientFor } from "./routine-link";

describe("routineClientFor（ルーティンのクライアントを決める）", () => {
  it("プロジェクトがあるとき、そのプロジェクトのクライアントにする", () => {
    expect(routineClientFor({ sentClientId: undefined, projectClientId: "c1", currentClientId: null })).toEqual({ ok: true, clientId: "c1" });
  });
  it("プロジェクトと同じクライアントが送られたとき、そのまま受け付ける", () => {
    expect(routineClientFor({ sentClientId: "c1", projectClientId: "c1", currentClientId: null })).toEqual({ ok: true, clientId: "c1" });
  });
  it("プロジェクトと違うクライアントが送られたとき、エラーを返す", () => {
    expect(routineClientFor({ sentClientId: "c2", projectClientId: "c1", currentClientId: null })).toEqual({
      ok: false,
      error: "プロジェクトとクライアントが合っていません",
    });
  });
  it("プロジェクトがないとき、送られたクライアントにする（空にもできる）", () => {
    expect(routineClientFor({ sentClientId: "c2", projectClientId: null, currentClientId: "c1" })).toEqual({ ok: true, clientId: "c2" });
    expect(routineClientFor({ sentClientId: null, projectClientId: null, currentClientId: "c1" })).toEqual({ ok: true, clientId: null });
  });
  it("プロジェクトもクライアントも送られていないとき、保存済みのクライアントのまま", () => {
    expect(routineClientFor({ sentClientId: undefined, projectClientId: null, currentClientId: "c1" })).toEqual({ ok: true, clientId: "c1" });
  });
});
