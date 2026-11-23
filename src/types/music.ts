export type TrackSource = 'audius' | 'archive' | 'itunes' | 'local';

export type TapeSide = 'A' | 'B';

export interface Track {
  id: string;
  source: TrackSource;
  sourceId: string;
  title: string;
  artist: string;
  artistId?: string;
  artistHandle?: string;
  artistBio?: string;
  artistAvatar?: string;
  album?: string;
  genre?: string;
  releaseYear?: string;
  duration: number;
  artwork?: string;
  streamUrl: string;
  archiveFile?: string;
  isPreview?: boolean;
  tags?: string[];
  cassetteTheme?: 'amber' | 'cobalt' | 'crimson' | 'olive' | 'chrome';
  localFileName?: string;
}

export interface ArtistProfile {
  name: string;
  id?: string;
  source: TrackSource;
  avatar?: string;
  bio?: string;
  genre?: string;
  handle?: string;
  tracks: Track[];
}

export type DeckState = 'stopped' | 'playing' | 'paused';
