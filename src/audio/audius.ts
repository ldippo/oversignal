/**
 * Audius API client: open, keyless, serves raw MP3 — the one streaming
 * catalog we can legally decode and analyze on every platform.
 */

const APP_NAME = "OVERSIGNAL";

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artUrl: string | null;
  duration: number; // seconds
  genre: string;
}

let host: string | null = null;

async function getHost(): Promise<string> {
  if (host) return host;
  const res = await fetch("https://api.audius.co");
  if (!res.ok) throw new Error("Audius host discovery failed");
  const data = (await res.json()) as { data: string[] };
  if (!data.data?.length) throw new Error("No Audius hosts available");
  host = data.data[0];
  return host;
}

interface RawTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  user?: { name?: string };
  artwork?: Record<string, string>;
}

function toTrack(raw: RawTrack): AudiusTrack {
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.user?.name ?? "unknown",
    artUrl: raw.artwork?.["150x150"] ?? raw.artwork?.["480x480"] ?? null,
    duration: raw.duration,
    genre: raw.genre ?? "",
  };
}

export async function trending(): Promise<AudiusTrack[]> {
  const h = await getHost();
  const res = await fetch(`${h}/v1/tracks/trending?app_name=${APP_NAME}`);
  if (!res.ok) throw new Error(`Audius trending failed (${res.status})`);
  const data = (await res.json()) as { data: RawTrack[] };
  return data.data.slice(0, 20).map(toTrack);
}

export async function search(query: string): Promise<AudiusTrack[]> {
  const h = await getHost();
  const res = await fetch(`${h}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP_NAME}`);
  if (!res.ok) throw new Error(`Audius search failed (${res.status})`);
  const data = (await res.json()) as { data: RawTrack[] };
  return data.data.slice(0, 20).map(toTrack);
}

/** Fetches the full MP3 (follows the node's redirect). */
export async function fetchStream(id: string): Promise<ArrayBuffer> {
  const h = await getHost();
  const res = await fetch(`${h}/v1/tracks/${id}/stream?app_name=${APP_NAME}`);
  if (!res.ok) throw new Error(`Audius stream failed (${res.status})`);
  return res.arrayBuffer();
}
