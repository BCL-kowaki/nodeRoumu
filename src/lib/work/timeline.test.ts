import { describe, expect, it } from "vitest";
import {
  DAY_END,
  SNAP_MINUTES,
  entryInterval,
  layoutColumns,
  minutesToTime,
  moveStart,
  resizeDuration,
  timeToMinutes,
  yToStart,
} from "./timeline";

const PX = 1; // 1分 = 1px（テストを読みやすくするため）

describe("timeToMinutes / minutesToTime", () => {
  it("HH:MM と分数を相互に変換する", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("yToStart（ドロップした位置 → 開始時刻）", () => {
  it("15分単位に寄せる（四捨五入）", () => {
    expect(SNAP_MINUTES).toBe(15);
    expect(yToStart(600, PX, 60)).toBe(600); // 10:00
    expect(yToStart(607, PX, 60)).toBe(600); // 10:07 → 10:00
    expect(yToStart(608, PX, 60)).toBe(615); // 10:08 → 10:15
  });
  it("一番上より上に置いたとき、0:00 にする", () => {
    expect(yToStart(-40, PX, 60)).toBe(0);
  });
  it("終わりが 24:00 を超える位置に置いたとき、24:00 に収まる開始時刻にする", () => {
    expect(yToStart(23 * 60 + 30, PX, 60)).toBe(23 * 60); // 60分の計画は 23:00 開始まで
  });
});

describe("moveStart（置いた計画を上下に動かす）", () => {
  it("動かした分だけ時刻を変え、15分単位に寄せる", () => {
    expect(moveStart(600, 47, PX, 60)).toBe(645); // +47分 → +45分
    expect(moveStart(600, -22, PX, 60)).toBe(585); // -22分 → -15分
  });
  it("0:00 より前・24:00 を超える位置には動かさない", () => {
    expect(moveStart(30, -120, PX, 60)).toBe(0);
    expect(moveStart(1300, 300, PX, 60)).toBe(DAY_END - 60);
  });
});

describe("5分単位で動かす（実績用）", () => {
  it("動かした分を5分単位に寄せる", () => {
    expect(moveStart(547, 12, PX, 40, 5)).toBe(560); // 9:07 → +12分 → 9:19 → 9:20
    expect(resizeDuration(547, 40, 7, PX, 5)).toBe(45);
  });
});

describe("resizeDuration（下の端を引いて長さを変える）", () => {
  it("引いた分だけ長くし、15分単位に寄せる", () => {
    expect(resizeDuration(600, 60, 32, PX)).toBe(90);
  });
  it("15分より短くはしない", () => {
    expect(resizeDuration(600, 60, -200, PX)).toBe(15);
  });
  it("24:00 を超えては伸ばさない", () => {
    expect(resizeDuration(23 * 60, 30, 300, PX)).toBe(60);
  });
});

describe("layoutColumns（時間が重なる計画を横に並べる）", () => {
  it("重ならないものは、それぞれ全幅", () => {
    const r = layoutColumns([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 600, end: 660 },
    ]);
    expect(r).toEqual({ a: { col: 0, cols: 1 }, b: { col: 0, cols: 1 } });
  });
  it("重なるものは、列を分けて並べる", () => {
    const r = layoutColumns([
      { id: "a", start: 540, end: 660 },
      { id: "b", start: 600, end: 720 },
      { id: "c", start: 690, end: 750 },
    ]);
    expect(r.a).toEqual({ col: 0, cols: 2 });
    expect(r.b).toEqual({ col: 1, cols: 2 });
    expect(r.c).toEqual({ col: 0, cols: 2 }); // a が終わった列を使う
  });
});

describe("entryInterval（タイマーの実績を、その日の時間帯に直す）", () => {
  const now = new Date("2026-10-07T05:00:00Z"); // 日本時間 14:00
  it("開始・終了を日本時間の分数にする", () => {
    expect(entryInterval("2026-10-07", "2026-10-07T00:30:00Z", "2026-10-07T01:15:00Z", now)).toEqual({ start: 570, end: 615 });
  });
  it("計測中で、画面の「今」より後に開始したばかりのときも、最低1分の長さで表示する", () => {
    expect(entryInterval("2026-10-07", "2026-10-07T05:00:30Z", null, now)).toEqual({ start: 840, end: 841 });
  });
  it("計測中は現在時刻までにする", () => {
    expect(entryInterval("2026-10-07", "2026-10-07T04:00:00Z", null, now)).toEqual({ start: 780, end: 840 });
  });
  it("前日から日をまたいだ実績は、その日の 0:00 から表示する", () => {
    expect(entryInterval("2026-10-07", "2026-10-06T14:00:00Z", "2026-10-06T16:00:00Z", now)).toEqual({ start: 0, end: 60 });
  });
  it("その日にかからない実績は null", () => {
    expect(entryInterval("2026-10-07", "2026-10-05T00:00:00Z", "2026-10-05T01:00:00Z", now)).toBeNull();
  });
  it("開始時刻のない（手入力の）実績は null", () => {
    expect(entryInterval("2026-10-07", null, null, now)).toBeNull();
  });
});
