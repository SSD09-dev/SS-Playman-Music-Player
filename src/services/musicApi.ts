import type { ArtistProfile, Track } from '../types/music';
import { decodeSongCode } from '../utils/songCode';

const AUDIUS_BASE = 'https://api.audius.co/v1';
const APP_NAME = 'SSPlayman';

const CASSETTE_THEMES: Array<Track['cassetteTheme']> = [
  'amber',
  'cobalt',
  'crimson',
  'olive',
  'chrome',
];

function pickCassetteTheme(seed: string): Track['cassetteTheme'] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CASSETTE_THEMES[hash % CASSETTE_THEMES.length];
}

interface AudiusUserRaw {
  id: string;
  name?: string;
  handle?: string;
  bio?: string;
  profile_picture?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
}

interface AudiusTrackRaw {
  id: string;
  title?: string;
  genre?: string;
  mood?: string;
  tags?: string;
  duration?: number;
  release_date?: string;
  description?: string;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  user?: AudiusUserRaw;
}

function mapAudiusTrack(raw: AudiusTrackRaw): Track {
  const artwork =
    raw.artwork?.['480x480'] ||
    raw.artwork?.['150x150'] ||
    raw.artwork?.['1000x1000'];
  const avatar =
    raw.user?.profile_picture?.['480x480'] ||
    raw.user?.profile_picture?.['150x150'];
  const tags = raw.tags
    ? raw.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    id: `audius-${raw.id}`,
    source: 'audius',
    sourceId: raw.id,
    title: raw.title || 'Untitled Track',
    artist: raw.user?.name || raw.user?.handle || 'Independent Artist',
    artistId: raw.user?.id,
    artistHandle: raw.user?.handle,
    artistBio: raw.user?.bio || raw.description,
    artistAvatar: avatar,
    album: raw.mood ? `${raw.mood} Sessions` : 'Audius Open Release',
    genre: raw.genre || 'Electronic',
    releaseYear: raw.release_date ? raw.release_date.slice(0, 4) : undefined,
    duration: typeof raw.duration === 'number' ? raw.duration : 180,
    artwork,
    streamUrl: `${AUDIUS_BASE}/tracks/${encodeURIComponent(raw.id)}/stream?app_name=${APP_NAME}`,
    isPreview: false,
    tags,
    cassetteTheme: pickCassetteTheme(raw.id),
  };
}

interface ItunesTrackRaw {
  trackId: number;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  previewUrl?: string;
}

function mapItunesTrack(raw: ItunesTrackRaw): Track | null {
  if (!raw.previewUrl) return null;
  const highResArt = raw.artworkUrl100
    ? raw.artworkUrl100.replace('100x100bb', '400x400bb')
    : undefined;

  return {
    id: `itunes-${raw.trackId}`,
    source: 'itunes',
    sourceId: String(raw.trackId),
    title: raw.trackName || 'Untitled Track',
    artist: raw.artistName || 'Unknown Artist',
    artistId: raw.artistId ? String(raw.artistId) : undefined,
    album: raw.collectionName || 'Single Release',
    genre: raw.primaryGenreName || 'Music',
    releaseYear: raw.releaseDate ? raw.releaseDate.slice(0, 4) : undefined,
    duration: 30,
    artwork: highResArt,
    streamUrl: raw.previewUrl,
    isPreview: true,
    tags: raw.primaryGenreName ? [raw.primaryGenreName] : [],
    cassetteTheme: pickCassetteTheme(String(raw.trackId)),
  };
}

export async function fetchStarterPlaylist(): Promise<Track[]> {
  try {
    const res = await fetch(
      `${AUDIUS_BASE}/tracks/trending?app_name=${APP_NAME}&limit=16`
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: AudiusTrackRaw[] };
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data.slice(0, 12).map(mapAudiusTrack);
      }
    }
  } catch {
    // Fallback to curated query below
  }

  return searchMusicCatalog('synthwave retro', 'full');
}

export async function searchAudius(query: string, limit = 12): Promise<Track[]> {
  const url = `${AUDIUS_BASE}/tracks/search?query=${encodeURIComponent(
    query
  )}&app_name=${APP_NAME}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: AudiusTrackRaw[] };
  if (!Array.isArray(json.data)) return [];
  return json.data.map(mapAudiusTrack);
}

interface ArchiveSearchDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  genre?: string | string[];
  date?: string;
}

interface ArchiveFileEntry {
  name: string;
  format?: string;
  title?: string;
  length?: string;
}

function parseArchiveLength(len?: string): number {
  if (!len) return 210;
  if (len.includes(':')) {
    const parts = len.split(':').map((n) => Number(n));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
  }
  const num = Number(len);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 210;
}

export async function fetchInternetArchiveTrack(
  identifier: string,
  preferredFile?: string
): Promise<Track | null> {
  try {
    const res = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      metadata?: {
        title?: string;
        creator?: string | string[];
        album?: string;
        genre?: string | string[];
        date?: string;
        description?: string;
      };
      files?: ArchiveFileEntry[];
    };

    const files = Array.isArray(data.files) ? data.files : [];
    const mp3File = preferredFile
      ? files.find((f) => f.name === preferredFile)
      : files.find(
          (f) =>
            f.name.toLowerCase().endsWith('.mp3') &&
            (f.format?.includes('MP3') || !f.format)
        );

    if (!mp3File) return null;

    const creatorRaw = data.metadata?.creator;
    const artist = Array.isArray(creatorRaw)
      ? creatorRaw[0]
      : creatorRaw || 'Internet Archive Artist';
    const genreRaw = data.metadata?.genre;
    const genre = Array.isArray(genreRaw)
      ? genreRaw[0]
      : genreRaw || 'Open Audio';

    return {
      id: `archive-${identifier}-${mp3File.name}`,
      source: 'archive',
      sourceId: identifier,
      archiveFile: mp3File.name,
      title: mp3File.title || data.metadata?.title || identifier,
      artist,
      artistBio: data.metadata?.description?.replace(/<[^>]+>/g, '').slice(0, 280),
      album: data.metadata?.album || 'Internet Archive Open Audio',
      genre,
      releaseYear: data.metadata?.date ? String(data.metadata.date).slice(0, 4) : undefined,
      duration: parseArchiveLength(mp3File.length),
      artwork: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      streamUrl: `https://archive.org/download/${encodeURIComponent(
        identifier
      )}/${mp3File.name.split('/').map(encodeURIComponent).join('/')}`,
      isPreview: false,
      tags: ['Open Archive', genre].filter(Boolean),
      cassetteTheme: pickCassetteTheme(identifier),
    };
  } catch {
    return null;
  }
}

export async function searchInternetArchive(query: string, limit = 6): Promise<Track[]> {
  try {
    const q = `(${query}) AND mediatype:audio AND format:MP3 AND collection:(audio_music OR netlabels OR etree)`;
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      q
    )}&fl[]=identifier,title,creator,genre,date&sort[]=downloads+desc&rows=${limit}&output=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      response?: { docs?: ArchiveSearchDoc[] };
    };
    const docs = json.response?.docs || [];
    const resolved = await Promise.allSettled(
      docs.slice(0, 4).map((doc) => fetchInternetArchiveTrack(doc.identifier))
    );
    return resolved
      .filter(
        (r): r is PromiseFulfilledResult<Track | null> =>
          r.status === 'fulfilled' && r.value !== null
      )
      .map((r) => r.value as Track);
  } catch {
    return [];
  }
}

export async function searchItunes(query: string, limit = 25): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    query
  )}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`iTunes HTTP ${res.status}`);
  }
  const json = (await res.json()) as { results?: ItunesTrackRaw[] };
  if (!Array.isArray(json.results)) return [];
  return json.results
    .map(mapItunesTrack)
    .filter((t): t is Track => t !== null);
}

export type CatalogFilter = 'all' | 'full' | 'mainstream';

export async function searchMusicCatalog(
  query: string,
  filter: CatalogFilter = 'all'
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Primary global catalog: official CORS-friendly iTunes Search API
  if (filter === 'all' || filter === 'mainstream') {
    let itunesTracks: Track[] = [];
    let itunesFailed = false;

    try {
      itunesTracks = await searchItunes(trimmed, 25);
    } catch {
      itunesFailed = true;
    }

    if (itunesTracks.length > 0) {
      return itunesTracks;
    }

    // Clean fallback to Internet Archive Advanced Search for public-domain full-length audio
    if (filter === 'all' || itunesFailed) {
      const archiveFallback = await searchInternetArchive(trimmed, 8);
      if (archiveFallback.length > 0) {
        return archiveFallback;
      }
    }

    if (itunesFailed) {
      throw new Error('NO SIGNAL');
    }
    return [];
  }

  // Full-Length Open Audio filter: Internet Archive + Audius
  const settled = await Promise.allSettled([
    searchInternetArchive(trimmed, 8),
    searchAudius(trimmed, 12),
  ]);
  const combined: Track[] = [];
  const seen = new Set<string>();

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      for (const track of res.value) {
        const key = `${track.title.toLowerCase()}::${track.artist.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(track);
        }
      }
    }
  }

  return combined;
}

export async function fetchAudiusTrackById(id: string): Promise<Track | null> {
  try {
    const res = await fetch(
      `${AUDIUS_BASE}/tracks/${encodeURIComponent(id)}?app_name=${APP_NAME}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: AudiusTrackRaw };
    if (!json.data) return null;
    return mapAudiusTrack(json.data);
  } catch {
    return null;
  }
}

export async function fetchItunesTrackById(id: string): Promise<Track | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: ItunesTrackRaw[] };
    const first = json.results?.[0];
    return first ? mapItunesTrack(first) : null;
  } catch {
    return null;
  }
}

export async function resolveSongCode(rawInput: string): Promise<Track | null> {
  const decoded = decodeSongCode(rawInput);
  if (!decoded) return null;

  if (decoded.source === 'audius') {
    const track = await fetchAudiusTrackById(decoded.sourceId);
    if (track) return track;
  } else if (decoded.source === 'archive') {
    const track = await fetchInternetArchiveTrack(
      decoded.sourceId,
      decoded.archiveFile
    );
    if (track) return track;
  } else if (decoded.source === 'itunes') {
    const track = await fetchItunesTrackById(decoded.sourceId);
    if (track) return track;
  }

  // Fallback search by title + artist if ID changed or shared from local filename
  const query =
    decoded.artist && decoded.artist !== 'Local Cassette'
      ? `${decoded.title} ${decoded.artist}`
      : decoded.title;
  const fallback = await searchMusicCatalog(query, 'all');
  return fallback[0] || null;
}

export async function fetchArtistProfile(track: Track): Promise<ArtistProfile> {
  let tracks: Track[] = [];

  if (track.source === 'audius' && track.artistId) {
    try {
      const res = await fetch(
        `${AUDIUS_BASE}/users/${encodeURIComponent(
          track.artistId
        )}/tracks?app_name=${APP_NAME}&limit=10`
      );
      if (res.ok) {
        const json = (await res.json()) as { data?: AudiusTrackRaw[] };
        if (Array.isArray(json.data)) {
          tracks = json.data.map(mapAudiusTrack);
        }
      }
    } catch {
      // Fallback below
    }
  } else if (track.source === 'itunes' && track.artistId) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(
          track.artistId
        )}&entity=song&limit=10`
      );
      if (res.ok) {
        const json = (await res.json()) as { results?: ItunesTrackRaw[] };
        if (Array.isArray(json.results)) {
          tracks = json.results
            .map(mapItunesTrack)
            .filter((t): t is Track => t !== null);
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (
    tracks.length === 0 &&
    !(track.source === 'local' && track.artist === 'Local Cassette')
  ) {
    tracks = await searchMusicCatalog(
      track.artist,
      track.source === 'itunes' ? 'mainstream' : 'all'
    );
  }

  return {
    name: track.artist,
    id: track.artistId,
    source: track.source,
    avatar: track.artistAvatar || track.artwork,
    bio:
      track.artistBio ||
      (track.source === 'local'
        ? `Loaded from your device storage${
            track.localFileName ? ` (${track.localFileName})` : ''
          }.`
        : `Featuring "${track.title}" from ${track.album || 'catalog releases'}.`),
    genre: track.genre,
    handle: track.artistHandle,
    tracks: tracks.slice(0, 8),
  };
}
