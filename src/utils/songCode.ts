import type { Track, TrackSource } from '../types/music';

interface CompactSongPayload {
  v: 1;
  s: 'au' | 'ia' | 'it' | 'lo';
  i: string;
  t: string;
  a: string;
  f?: string;
}

export interface DecodedSongPayload {
  source: TrackSource;
  sourceId: string;
  title: string;
  artist: string;
  archiveFile?: string;
}

const SOURCE_TO_SHORT: Record<TrackSource, 'au' | 'ia' | 'it' | 'lo'> = {
  audius: 'au',
  archive: 'ia',
  itunes: 'it',
  local: 'lo',
};

const SHORT_TO_SOURCE: Record<'au' | 'ia' | 'it' | 'lo', TrackSource> = {
  au: 'audius',
  ia: 'archive',
  it: 'itunes',
  lo: 'local',
};

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSongCode(track: Track): string {
  const payload: CompactSongPayload = {
    v: 1,
    s: SOURCE_TO_SHORT[track.source],
    i: track.sourceId,
    t: track.title.slice(0, 48),
    a: track.artist.slice(0, 36),
  };
  if (track.archiveFile) {
    payload.f = track.archiveFile.slice(0, 64);
  }
  return `SSP-${toBase64Url(JSON.stringify(payload))}`;
}

export function extractSongCodeFromInput(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (/^SSP-[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const paramCode = url.searchParams.get('code');
    if (paramCode && /^SSP-[A-Za-z0-9_-]+$/.test(paramCode.trim())) {
      return paramCode.trim();
    }
    const hashMatch = url.hash.match(/code=(SSP-[A-Za-z0-9_-]+)/);
    if (hashMatch) {
      return hashMatch[1];
    }
  } catch {
    // Not a full URL, check inline match
  }

  const inlineMatch = trimmed.match(/SSP-[A-Za-z0-9_-]+/);
  return inlineMatch ? inlineMatch[0] : null;
}

export function decodeSongCode(rawInput: string): DecodedSongPayload | null {
  const code = extractSongCodeFromInput(rawInput);
  if (!code || !code.startsWith('SSP-')) return null;

  try {
    const jsonStr = fromBase64Url(code.slice(4));
    const parsed = JSON.parse(jsonStr) as Partial<CompactSongPayload>;
    if (
      parsed.v !== 1 ||
      !parsed.s ||
      !(parsed.s in SHORT_TO_SOURCE) ||
      !parsed.i
    ) {
      return null;
    }

    return {
      source: SHORT_TO_SOURCE[parsed.s],
      sourceId: String(parsed.i),
      title: parsed.t ? String(parsed.t) : 'Shared Cassette',
      artist: parsed.a ? String(parsed.a) : 'Unknown Artist',
      archiveFile: parsed.f ? String(parsed.f) : undefined,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(track: Track): string {
  const code = encodeSongCode(track);
  if (typeof window === 'undefined') {
    return `https://ssplayman.app/?code=${code}`;
  }
  return `${window.location.origin}/?code=${code}`;
}
