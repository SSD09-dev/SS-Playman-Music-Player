import type { Track } from '../types/music';

const CASSETTE_THEMES: Array<NonNullable<Track['cassetteTheme']>> = [
  'amber',
  'cobalt',
  'crimson',
  'olive',
  'chrome',
];

function pickCassetteTheme(seed: string): NonNullable<Track['cassetteTheme']> {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CASSETTE_THEMES[hash % CASSETTE_THEMES.length];
}

export interface ParsedTrackFilename {
  title: string;
  artist: string;
  extension: string;
}

export function parseAudioFilename(filename: string): ParsedTrackFilename {
  const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extMatch ? extMatch[1].toUpperCase() : 'AUDIO';

  // Strip audio extension
  let stem = filename
    .replace(/\.(mp3|m4a|wav|flac|ogg|aac|opus|webm|wma|aiff)$/i, '')
    .trim();

  // Normalize underscores when filenames use snake_case
  if (!stem.includes(' ') && stem.includes('_')) {
    stem = stem.replace(/_/g, ' ');
  }
  stem = stem.replace(/\s+/g, ' ').trim();

  // Split on standard " - ", " – ", or " — " separators
  const parts = stem
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3 && /^\d{1,3}$/.test(parts[0])) {
    return {
      artist: parts[1],
      title: parts.slice(2).join(' - '),
      extension,
    };
  }

  if (parts.length >= 2) {
    if (/^\d{1,3}$/.test(parts[0])) {
      return {
        artist: 'Local Cassette',
        title: parts.slice(1).join(' - '),
        extension,
      };
    }
    return {
      artist: parts[0],
      title: parts.slice(1).join(' - '),
      extension,
    };
  }

  // Strip optional leading track prefix like "01. Song Name"
  const cleanTitle = stem.replace(/^\d{1,3}[.\s]+/, '').trim() || stem || 'Untitled Track';

  return {
    artist: 'Local Cassette',
    title: cleanTitle,
    extension,
  };
}

export function createLocalTracksFromFiles(files: FileList | File[]): {
  tracks: Track[];
  objectUrls: string[];
} {
  const fileArray = Array.from(files).filter((file) => {
    if (file.type.startsWith('audio/')) return true;
    return /\.(mp3|m4a|wav|flac|ogg|aac|opus|webm)$/i.test(file.name);
  });

  const tracks: Track[] = [];
  const objectUrls: string[] = [];
  const stamp = Date.now();

  fileArray.forEach((file, index) => {
    const objectUrl = URL.createObjectURL(file);
    objectUrls.push(objectUrl);

    const parsed = parseAudioFilename(file.name);
    const id = `local-${stamp}-${index}-${file.name}`;

    tracks.push({
      id,
      source: 'local',
      sourceId: id,
      title: parsed.title,
      artist: parsed.artist,
      album: 'My Local Tape',
      genre: `${parsed.extension} Local Audio`,
      duration: 0,
      streamUrl: objectUrl,
      isPreview: false,
      tags: ['Local File', parsed.extension],
      cassetteTheme: pickCassetteTheme(file.name),
      localFileName: file.name,
    });
  });

  return { tracks, objectUrls };
}

export function probeAudioDuration(objectUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const probe = document.createElement('audio');
    probe.preload = 'metadata';

    const cleanup = () => {
      probe.removeAttribute('src');
      probe.load();
    };

    probe.onloadedmetadata = () => {
      const dur = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      cleanup();
      resolve(dur);
    };

    probe.onerror = () => {
      cleanup();
      resolve(0);
    };

    probe.src = objectUrl;
  });
}
