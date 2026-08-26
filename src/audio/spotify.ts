/**
 * Cosmetic Spotify integration: Authorization Code + PKCE (no backend, no
 * client secret) and the currently-playing endpoint. Gameplay never depends
 * on this — Spotify deprecated audio analysis for new apps, so beat data
 * still comes from live capture. This only feeds the now-playing HUD.
 */

const CLIENT_ID_KEY = "fzero-spotify-client-id";
const VERIFIER_KEY = "fzero-spotify-verifier";
const TOKEN_KEY = "fzero-spotify-token-v1";
const SCOPE = "user-read-currently-playing";

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export interface NowPlaying {
  title: string;
  artists: string;
  artUrl: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  fetchedAt: number; // performance-independent epoch ms
}

function redirectUri(): string {
  return window.location.origin + "/";
}

export function getClientId(): string | null {
  return (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || localStorage.getItem(CLIENT_ID_KEY);
}

export function setClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function saveToken(data: { access_token: string; refresh_token?: string; expires_in: number }, prevRefresh?: string): StoredToken {
  const token: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? prevRefresh ?? "",
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

export function isConnected(): boolean {
  return loadToken() !== null;
}

export function disconnect(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Redirect to Spotify consent. Resolves never (page navigates away). */
export async function beginAuth(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error("No Spotify Client ID configured.");
  const verifierBytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = base64url(verifierBytes);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPE,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function tokenRequest(body: URLSearchParams): Promise<StoredToken> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);
  const prev = loadToken()?.refresh_token;
  return saveToken(await res.json(), prev);
}

/** Call on page load; exchanges ?code= if present. Returns true if just connected. */
export async function handleRedirect(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return false;
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.pathname + url.hash);
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const clientId = getClientId();
  if (!verifier || !clientId) return false;
  localStorage.removeItem(VERIFIER_KEY);
  await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  );
  return true;
}

async function accessToken(): Promise<string | null> {
  let token = loadToken();
  if (!token) return null;
  if (Date.now() >= token.expires_at) {
    const clientId = getClientId();
    if (!clientId || !token.refresh_token) {
      disconnect();
      return null;
    }
    try {
      token = await tokenRequest(
        new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        }),
      );
    } catch {
      disconnect();
      return null;
    }
  }
  return token.access_token;
}

/** null = not connected / nothing playing / error (all non-fatal). */
export async function fetchNowPlaying(): Promise<NowPlaying | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json();
    const item = data?.item;
    if (!item) return null;
    return {
      title: item.name ?? "",
      artists: (item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      artUrl: item.album?.images?.at(-1)?.url ?? item.album?.images?.[0]?.url ?? null,
      progressMs: data.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
      isPlaying: !!data.is_playing,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
