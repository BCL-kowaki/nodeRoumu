// Google カレンダー API の呼び出し（サーバー専用）
// - 求める権限は最小限: calendar.app.created（アプリが作る専用カレンダーの作成・管理）と
//   calendar.events.readonly（既存の予定の読み取りだけ）。既存の予定は書き換えられない。
//   タスクの添付資料用に drive.file（アプリが作ったファイルだけ扱える）も一緒にもらう。
// - 更新用トークンは暗号化してDBに保存し、アクセストークン（約1時間）は保存せず都度取得する。
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { getGoogleLoginConfig, pkceChallenge } from "@/lib/google-login";
import { DRIVE_FILE_SCOPE } from "@/lib/work/attachments";
import {
  PLAN_CALENDAR_NAME,
  calendarRange,
  expandEventToDays,
  type DayEvent,
  type EventBody,
  type GoogleCalendarEvent,
  type UserInfo,
} from "@/lib/work/gcal";

// 手元での動作確認用に、テスト用の偽サーバーへ向けられる（本番では未設定＝本物の Google）
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token";
const REVOKE_URL = process.env.GOOGLE_OAUTH_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";
const CAL_BASE = process.env.GOOGLE_CALENDAR_API_BASE || "https://www.googleapis.com/calendar/v3";

export const GCAL_OAUTH_COOKIE = "roumu-gcal-oauth";
export const GCAL_OAUTH_COOKIE_MAX_AGE = 60 * 10;
export const GCAL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  DRIVE_FILE_SCOPE,
];

export class GcalError extends Error {
  constructor(public status: number, message = "") {
    super(message);
  }
}

// 画面に出してよいエラーメッセージ（Google の応答本文は返さない）
export function gcalErrorMessage(e: unknown): string {
  if (!(e instanceof GcalError)) return "Google カレンダーとの通信に失敗しました";
  if (e.status === 0) return e.message;
  if (e.status === 401 || e.status === 400) return "Google カレンダーの接続が無効になりました。設定から接続し直してください";
  if (e.status === 403) return "Google カレンダーの権限が足りません（Calendar API が有効か、権限を許可したかを確認してください）";
  if (e.status === 404) return "Google カレンダーで見つかりません";
  if (e.status === 429) return "Google カレンダーの利用回数の上限に達しました。しばらく待ってからお試しください";
  return `Google カレンダーとの通信に失敗しました（${e.status}）`;
}

// OAuth の設定。ログイン用の Google 設定（クライアントID・許可ドメイン・許可アカウント）を共用する
export function gcalConfig() {
  const c = getGoogleLoginConfig();
  if (!c) return null;
  return c;
}

export function buildCalendarAuthUrl(redirectUri: string, p: { state: string; codeVerifier: string }): string {
  const c = gcalConfig();
  if (!c) throw new GcalError(0, "Google の設定がありません");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GCAL_SCOPES.join(" "),
    state: p.state,
    code_challenge: pkceChallenge(p.codeVerifier),
    code_challenge_method: "S256",
    access_type: "offline", // 更新用トークンをもらう
    prompt: "consent", // 毎回同意画面を出す（更新用トークンを確実に受け取るため）
    login_hint: c.allowedEmail,
    hd: c.allowedDomain,
  }).toString();
  return url.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const c = gcalConfig();
  if (!c) throw new GcalError(0, "Google の設定がありません");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`Google トークン要求に失敗しました（status ${res.status}）`);
    throw new GcalError(res.status === 400 || res.status === 401 ? 401 : res.status);
  }
  return res.json();
}

// 認可コード → トークン。接続してよいアカウントかも、ここで確認する（Google から直接受け取った情報で判定）
export async function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier });
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new GcalError(res.status);
  return res.json();
}

// 接続を保存する（更新用トークンは暗号化）
export async function saveConnection(ownerId: string, t: { refresh_token: string; expires_in: number; scope?: string }, email: string) {
  const data = {
    accountEmail: email,
    encryptedRefreshToken: encrypt(t.refresh_token),
    accessTokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
    scopes: t.scope ?? null,
    status: "active",
  };
  return prisma.integrationAccount.upsert({
    where: { ownerId_provider: { ownerId, provider: "google" } },
    update: data,
    create: { ownerId, provider: "google", ...data },
  });
}

export async function getConnection(ownerId: string) {
  return prisma.integrationAccount.findUnique({ where: { ownerId_provider: { ownerId, provider: "google" } } });
}

// 有効なアクセストークンを得る。更新用トークンが無効（取り消し・期限切れ）なら「要再接続」にする
export async function getAccessToken(ownerId: string): Promise<string> {
  const acc = await getConnection(ownerId);
  if (!acc || acc.status !== "active") throw new GcalError(401);
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acc.encryptedRefreshToken) });
    return t.access_token;
  } catch (e) {
    if (e instanceof GcalError && e.status === 401) {
      await prisma.integrationAccount.update({ where: { id: acc.id }, data: { status: "needs_reconnect" } });
    }
    throw e;
  }
}

// 接続を解除する（Google 側でもトークンを取り消してから、DBから削除）
export async function disconnect(ownerId: string) {
  const acc = await getConnection(ownerId);
  if (!acc) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decrypt(acc.encryptedRefreshToken) }),
    });
  } catch {
    // 取り消しに失敗しても、こちらの保存は消す（Google 側のアカウント設定からも取り消せる）
  }
  await prisma.integrationAccount.delete({ where: { id: acc.id } });
}

async function cal(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok && !(init?.method === "DELETE" && (res.status === 404 || res.status === 410))) {
    console.error(`Google Calendar API エラー: ${init?.method ?? "GET"} ${path.split("?")[0]} → ${res.status}`);
    throw new GcalError(res.status);
  }
  return res;
}

// 期間内の予定（メインのカレンダー）を、日ごとの表示用に展開して返す
export async function listDayEvents(ownerId: string, from: string, to: string): Promise<DayEvent[]> {
  const token = await getAccessToken(ownerId);
  const { timeMin, timeMax } = calendarRange(from, to);
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (pageToken) q.set("pageToken", pageToken);
    const data = (await (await cal(token, `/calendars/primary/events?${q}`)).json()) as { items?: GoogleCalendarEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return events
    .flatMap((e) => expandEventToDays(e, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

// 書き出し先の専用カレンダー「業務計画」。無ければ作る
export async function ensurePlanCalendar(ownerId: string, token: string): Promise<string> {
  const acc = await getConnection(ownerId);
  if (!acc) throw new GcalError(401);
  if (acc.calendarId) return acc.calendarId;
  const res = await cal(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: PLAN_CALENDAR_NAME, timeZone: "Asia/Tokyo", description: "node-portal の業務計画（アプリが自動で書き出します）" }),
  });
  const { id } = (await res.json()) as { id: string };
  await prisma.integrationAccount.update({ where: { id: acc.id }, data: { calendarId: id } });
  return id;
}

// 予定を作る／更新する。更新先が Google 側で削除されていた（404・410）ときは作り直す
export async function upsertEvent(token: string, calendarId: string, eventId: string | null, body: EventBody): Promise<string> {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  if (eventId) {
    try {
      const res = await cal(token, `${base}/${encodeURIComponent(eventId)}`, { method: "PUT", body: JSON.stringify(body) });
      return ((await res.json()) as { id: string }).id;
    } catch (e) {
      if (!(e instanceof GcalError && (e.status === 404 || e.status === 410))) throw e;
    }
  }
  const res = await cal(token, base, { method: "POST", body: JSON.stringify(body) });
  return ((await res.json()) as { id: string }).id;
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  await cal(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}
