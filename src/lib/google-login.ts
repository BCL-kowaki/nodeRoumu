// 代表者用の Google（Workspace）ログイン。
// 社労士・従業員はこれまで通り ID・パスワードでログインする。
// 代表者は1人のため、どの Google アカウントをどのログインIDに対応させるかは環境変数で指定する。
import { createHash, randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const GOOGLE_OAUTH_COOKIE = "roumu-google-oauth";
// 認可開始〜コールバックまでの一時Cookieの有効期間（秒）
export const GOOGLE_OAUTH_COOKIE_MAX_AGE = 60 * 10;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleLoginConfig = {
  clientId: string;
  clientSecret: string;
  allowedDomain: string; // Workspace のドメイン（例: example.co.jp）
  allowedEmail: string;  // ログインを許可する代表者の Google アカウント
  loginId: string;       // 対応させる代表者のログインID
};

// 環境変数から設定を読む。1つでも欠けていれば null（Googleログインは無効）
export function getGoogleLoginConfig(): GoogleLoginConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const allowedDomain = process.env.GOOGLE_LOGIN_DOMAIN;
  const allowedEmail = process.env.GOOGLE_LOGIN_EMAIL;
  const loginId = process.env.GOOGLE_LOGIN_ID;
  if (!clientId || !clientSecret || !allowedDomain || !allowedEmail || !loginId) return null;
  return {
    clientId,
    clientSecret,
    allowedDomain: allowedDomain.toLowerCase(),
    allowedEmail: allowedEmail.toLowerCase(),
    loginId,
  };
}

// 推測できない乱数文字列（state / nonce / PKCE の code_verifier 用）
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// PKCE: code_verifier から code_challenge（S256）を作る
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(
  config: GoogleLoginConfig,
  redirectUri: string,
  params: { state: string; nonce: string; codeVerifier: string }
): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state: params.state,
    nonce: params.nonce,
    code_challenge: pkceChallenge(params.codeVerifier),
    code_challenge_method: "S256",
    hd: config.allowedDomain, // アカウント選択画面を Workspace ドメインに絞る（最終判定は検証側で行う）
    login_hint: config.allowedEmail,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

// 認可コードを ID トークンに交換する
export async function exchangeCodeForIdToken(
  config: GoogleLoginConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string
): Promise<string | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    // 応答本文にはトークン等が含まれうるため、ステータスだけを記録する
    console.error(`Google トークン交換に失敗しました（status ${res.status}）`);
    return null;
  }
  const data = (await res.json()) as { id_token?: string };
  return data.id_token ?? null;
}

export type GoogleIdentityCheck =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid_token" | "nonce" | "unverified" | "domain" | "email" };

// ID トークンの署名・発行者・宛先を検証し、許可された代表者本人かを判定する
export async function verifyGoogleIdentity(
  config: GoogleLoginConfig,
  idToken: string,
  expectedNonce: string
): Promise<GoogleIdentityCheck> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: config.clientId,
    }));
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
  return checkGoogleClaims(config, payload, expectedNonce);
}

// ID トークンの中身（署名検証済み）が許可条件を満たすか。決定的な判定なので単独で切り出す
export function checkGoogleClaims(
  config: GoogleLoginConfig,
  payload: Record<string, unknown>,
  expectedNonce: string
): GoogleIdentityCheck {
  if (payload.nonce !== expectedNonce) return { ok: false, reason: "nonce" };
  if (payload.email_verified !== true) return { ok: false, reason: "unverified" };
  // hd は Workspace アカウントにだけ付く。個人の Gmail は hd が無いのでここで弾かれる
  if (typeof payload.hd !== "string" || payload.hd.toLowerCase() !== config.allowedDomain) {
    return { ok: false, reason: "domain" };
  }
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (email !== config.allowedEmail) return { ok: false, reason: "email" };
  return { ok: true, email };
}
