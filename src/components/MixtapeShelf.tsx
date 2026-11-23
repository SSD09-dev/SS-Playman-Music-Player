import React from 'react';
import { Disc3, Play, QrCode, Trash2, User } from 'lucide-react';
import type { Track } from '../types/music';

interface MixtapeShelfProps {
  favorites: Track[];
  localTracks?: Track[];
  currentTrackId?: string;
  onSelectTrack: (track: Track, queueContext?: Track[]) => void;
  onRemoveFavorite: (trackId: string) => void;
  onOpenQr: (track: Track) => void;
  onOpenSinger: (track: Track) => void;
}

const SPINE_COLORS: Record<NonNullable<Track['cassetteTheme']>, string> = {
  amber: 'bg-amber-500',
  cobalt: 'bg-blue-500',
  crimson: 'bg-rose-500',
  olive: 'bg-lime-500',
  chrome: 'bg-slate-400',
};

export const MixtapeShelf: React.FC<MixtapeShelfProps> = ({
  favorites,
  localTracks = [],
  currentTrackId,
  onSelectTrack,
  onRemoveFavorite,
  onOpenQr,
  onOpenSinger,
}) => {
  if (favorites.length === 0 && localTracks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#12161f] p-6 text-center">
        <Disc3 className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-2 text-sm font-medium text-slate-300">
          Your Mixtape Shelf is Empty
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tap the Heart button on any track to save it here, or tap{' '}
          <strong className="text-slate-300">LOAD TAPE (.MP3)</strong> above to
          play local audio files from your device.
        </p>
      </div>
    );
  }

  const renderTrackList = (
    list: Track[],
    allowRemove: boolean
  ) =>
    list.map((track, idx) => {
      const isCurrent = track.id === currentTrackId;
      const spineColor = SPINE_COLORS[track.cassetteTheme || 'amber'];
      return (
        <div
          key={track.id}
          className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border transition ${
            isCurrent
              ? 'border-amber-500/60 bg-amber-500/10'
              : 'border-slate-800 bg-[#141821] hover:border-slate-700'
          }`}
        >
          {/* Cassette Spine Strip */}
          <div className={`w-2 self-stretch shrink-0 ${spineColor}`} />

          <button
            type="button"
            onClick={() => onSelectTrack(track, list)}
            className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2 text-left"
          >
            <span className="font-mono-lcd w-5 shrink-0 text-xs font-semibold text-slate-500">
              {String(idx + 1).padStart(2, '0')}
            </span>
            {track.artwork ? (
              <img
                src={track.artwork}
                alt={track.title}
                referrerPolicy="no-referrer"
                className="h-10 w-10 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400">
                <Disc3 className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-sm font-semibold ${
                  isCurrent ? 'text-amber-300' : 'text-slate-100'
                }`}
              >
                {track.title}
              </div>
              <div className="truncate text-xs text-slate-400">
                {track.artist} ·{' '}
                {track.source === 'local'
                  ? track.tags?.[1] || 'Local Tape'
                  : track.genre || 'Tape'}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 items-center pr-1.5">
            <button
              type="button"
              onClick={() => onOpenSinger(track)}
              aria-label={`Singer info for ${track.artist}`}
              className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <User className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenQr(track)}
              aria-label={`Share QR for ${track.title}`}
              className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-amber-300"
            >
              <QrCode className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectTrack(track, list)}
              aria-label={`Play ${track.title}`}
              className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-lg text-amber-400 hover:bg-slate-800"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
            {allowRemove && (
              <button
                type="button"
                onClick={() => onRemoveFavorite(track.id)}
                aria-label={`Remove ${track.title} from Mixtape`}
                className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      );
    });

  return (
    <div className="hardware-scroll flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
      {localTracks.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5 text-[11px] font-bold tracking-wider uppercase text-amber-400">
            <span>Loaded Local Tape ({localTracks.length})</span>
            <span className="font-mono-lcd text-[10px] text-slate-400">
              DEVICE AUDIO
            </span>
          </div>
          {renderTrackList(localTracks, false)}
        </div>
      )}

      {favorites.length > 0 && (
        <div className="flex flex-col gap-2">
          {localTracks.length > 0 && (
            <div className="flex items-center justify-between px-0.5 pt-1 text-[11px] font-bold tracking-wider uppercase text-slate-400">
              <span>Saved Mixtape Favorites ({favorites.length})</span>
            </div>
          )}
          {renderTrackList(favorites, true)}
        </div>
      )}
    </div>
  );
};
