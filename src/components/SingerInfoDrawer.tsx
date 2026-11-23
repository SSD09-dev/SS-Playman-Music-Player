import React, { useEffect, useState } from 'react';
import { Disc3, Loader2, Play, User, X } from 'lucide-react';
import type { ArtistProfile, Track } from '../types/music';
import { fetchArtistProfile } from '../services/musicApi';

interface SingerInfoDrawerProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: Track) => void;
  currentTrackId?: string;
}

export const SingerInfoDrawer: React.FC<SingerInfoDrawerProps> = ({
  track,
  isOpen,
  onClose,
  onSelectTrack,
  currentTrackId,
}) => {
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !track) return;
    let cancelled = false;
    setLoading(true);
    fetchArtistProfile(track)
      .then((res) => {
        if (!cancelled) setProfile(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, track]);

  if (!isOpen || !track) return null;

  const avatarSrc = profile?.avatar || track.artistAvatar || track.artwork;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Singer info for ${track.artist}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-700/80 bg-[#191d26] text-slate-100 shadow-2xl sm:rounded-2xl"
      >
        {/* Mobile grab handle */}
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-lg font-bold tracking-wide uppercase text-white">
              Singer & Liner Notes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close singer info"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="hardware-scroll flex-1 overflow-y-auto p-5">
          {/* Artist Hero */}
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={track.artist}
                referrerPolicy="no-referrer"
                className="h-20 w-20 shrink-0 rounded-2xl border border-slate-700 object-cover shadow-md"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-amber-400">
                <Disc3 className="h-9 w-9" />
              </div>
            )}

            <div className="min-w-0">
              <h3 className="truncate font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                {track.artist}
              </h3>
              {/* Clean unboxed typographic metadata */}
              <p className="mt-1 text-xs text-slate-400">
                {[
                  track.genre || 'Independent',
                  track.album || 'Single Release',
                  track.releaseYear,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {track.tags && track.tags.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-300/85">
                  {track.tags.slice(0, 4).join(' / ')}
                </p>
              )}
            </div>
          </div>

          {/* Bio / Album liner note */}
          <div className="mt-5 border-t border-slate-800 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Artist Notes
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {profile?.bio ||
                (track.source === 'local'
                  ? `Playing "${track.title}" directly from local storage${
                      track.localFileName ? ` (${track.localFileName})` : ''
                    }.`
                  : `Streaming "${track.title}" directly via ${
                      track.source === 'audius'
                        ? 'Audius Open Catalog'
                        : track.source === 'archive'
                          ? 'Internet Archive Open Audio'
                          : 'iTunes Music Catalog'
                    }.`)}
            </p>
          </div>

          {/* More Tracks by Artist */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                More Cassettes by {track.artist}
              </h4>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
            </div>

            {!loading && (!profile || profile.tracks.length === 0) ? (
              <p className="mt-3 text-sm text-slate-500">
                No additional tracks listed for this artist right now.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-800/80">
                {(profile?.tracks || []).map((item) => {
                  const isCurrent = item.id === currentTrackId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTrack(item);
                        onClose();
                      }}
                      className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left transition hover:bg-slate-800/40 px-2 rounded-lg"
                    >
                      {item.artwork ? (
                        <img
                          src={item.artwork}
                          alt={item.title}
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
                          {item.title}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {item.album || item.genre || 'Catalog'} ·{' '}
                          {item.isPreview ? '30s Preview' : 'Full Track'}
                        </div>
                      </div>
                      <Play className="h-4 w-4 shrink-0 text-amber-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
