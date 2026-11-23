import React, { useEffect, useMemo, useState } from 'react';
import { Disc3, Heart, Loader2, Play, Search } from 'lucide-react';
import type { Track } from '../types/music';
import { searchMusicCatalog } from '../services/musicApi';
import { playMechanicalClick } from '../utils/soundFx';
import {
  DISCOVERY_POOL,
  type TasteMap,
  getTopPersonalChips,
  normalizeTasteKey,
  pickDiscoveryChips,
} from '../utils/tasteTracker';

interface SearchCatalogProps {
  currentTrackId?: string;
  favoriteIds: Set<string>;
  onSelectTrack: (track: Track, queueContext?: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  initialTracks: Track[];
  tasteMap: TasteMap;
  onRecordTaste: (singerOrTerm: string, weight?: number) => void;
  sfxEnabled?: boolean;
  onSearchStatus?: (status: 'searching' | 'found' | 'not_found', count?: number) => void;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const SearchCatalog: React.FC<SearchCatalogProps> = ({
  currentTrackId,
  favoriteIds,
  onSelectTrack,
  onToggleFavorite,
  initialTracks,
  tasteMap,
  onRecordTaste,
  sfxEnabled = true,
  onSearchStatus,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personalChips = useMemo(() => getTopPersonalChips(tasteMap, 3), [tasteMap]);
  const neededDiscovery = Math.max(0, 6 - personalChips.length);

  const [discoveryChips, setDiscoveryChips] = useState<string[]>(() =>
    pickDiscoveryChips(personalChips, neededDiscovery)
  );

  useEffect(() => {
    const personalKeys = new Set(personalChips.map(normalizeTasteKey));
    setDiscoveryChips((prev) => {
      const kept = prev.filter((chip) => !personalKeys.has(normalizeTasteKey(chip)));
      if (kept.length >= neededDiscovery) {
        return kept.slice(0, neededDiscovery);
      }
      const missing = neededDiscovery - kept.length;
      const topUp = pickDiscoveryChips([...personalChips, ...kept], missing, prev);
      return [...kept, ...topUp];
    });
  }, [personalChips, neededDiscovery]);

  const handleShuffleDiscovery = () => {
    playMechanicalClick('key', sfxEnabled);
    setDiscoveryChips((prev) =>
      pickDiscoveryChips(personalChips, neededDiscovery, prev)
    );
  };

  const runSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    onSearchStatus?.('searching');
    try {
      const tracks = await searchMusicCatalog(clean, 'all');
      setResults(tracks);

      const cleanNorm = normalizeTasteKey(clean);
      const poolMatch = DISCOVERY_POOL.find(
        (tag) => normalizeTasteKey(tag) === cleanNorm
      );
      if (poolMatch) {
        onRecordTaste(poolMatch, 1);
      } else if (tracks.length > 0) {
        const matchingArtist = tracks.find((t) =>
          normalizeTasteKey(t.artist).includes(cleanNorm)
        );
        onRecordTaste(matchingArtist?.artist || tracks[0].artist || clean, 1);
      } else {
        onRecordTaste(clean, 1);
      }

      if (tracks.length === 0) {
        onSearchStatus?.('not_found', 0);
      } else {
        onSearchStatus?.('found', tracks.length);
      }
    } catch {
      onRecordTaste(clean, 1);
      setResults([]);
      setError('NO SIGNAL / NOT FOUND — Check your connection or try another query.');
      onSearchStatus?.('not_found', 0);
    } finally {
      setLoading(false);
    }
  };

  const displayedTracks = hasSearched ? results : initialTracks;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Single FIND Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search English, Telugu, Hindi, or any artist..."
            aria-label="Search online songs and artists"
            className="min-h-[44px] w-full rounded-xl border border-slate-700/80 bg-[#12161f] pr-3 pl-10 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="min-h-[44px] shrink-0 rounded-xl bg-amber-500 px-4 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-45"
        >
          {loading ? 'Searching...' : 'Find'}
        </button>
      </form>

      {/* Personalized Top-3 + Discovery Chips + ↻ Shuffle Mini-Chip */}
      <div className="flex flex-wrap items-center gap-1.5">
        {personalChips.map((tag) => (
          <button
            key={`personal-${normalizeTasteKey(tag)}`}
            type="button"
            onClick={() => {
              setQuery(tag);
              runSearch(tag);
            }}
            title="Based on your listening taste on this device"
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            <span>{tag}</span>
          </button>
        ))}

        {discoveryChips.map((tag) => (
          <button
            key={`discovery-${normalizeTasteKey(tag)}`}
            type="button"
            onClick={() => {
              setQuery(tag);
              runSearch(tag);
            }}
            className="rounded-md border border-slate-700/70 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/60 hover:text-amber-300"
          >
            {tag}
          </button>
        ))}

        <button
          type="button"
          onClick={handleShuffleDiscovery}
          aria-label="Refresh discovery suggestions"
          title="Shuffle discovery chips"
          className="inline-flex min-h-[26px] min-w-[28px] items-center justify-center rounded-md border border-slate-600/80 bg-[#1e2430] px-2 py-1 text-xs font-bold text-amber-300 shadow-[0_1px_0_#0b0e14] transition hover:border-amber-500/70 hover:text-amber-200 active:translate-y-[1px]"
        >
          ↻
        </button>
      </div>

      {/* Results List */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {hasSearched
            ? `Search Results (${displayedTracks.length})`
            : `Featured Tape Rotation (${displayedTracks.length})`}
        </span>
        {hasSearched && (
          <button
            type="button"
            onClick={() => {
              setHasSearched(false);
              setError(null);
              setQuery('');
            }}
            className="text-amber-400 hover:underline"
          >
            Back to Rotation
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#12161f] py-12 text-amber-300">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span className="font-mono-lcd text-xs font-bold tracking-widest uppercase">
            SEARCHING...
          </span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-center">
          <div className="font-mono-lcd text-xs font-bold tracking-widest text-rose-300">
            NO SIGNAL / NOT FOUND
          </div>
          <p className="mt-1 text-xs text-rose-200/80">{error}</p>
        </div>
      ) : displayedTracks.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-[#12161f] p-6 text-center">
          <div className="font-mono-lcd text-xs font-bold tracking-widest text-amber-300">
            NO SIGNAL / NOT FOUND
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            No matching songs found. Try another song or singer name, or load local files from the Mixtape tab.
          </p>
        </div>
      ) : (
        <div className="hardware-scroll max-h-[380px] divide-y divide-slate-800/80 overflow-y-auto pr-1">
          {displayedTracks.map((track) => {
            const isCurrent = track.id === currentTrackId;
            const isFav = favoriteIds.has(track.id);
            return (
              <div
                key={track.id}
                className={`flex min-h-[60px] items-center gap-3 rounded-lg px-2 py-2 transition ${
                  isCurrent ? 'bg-amber-500/12' : 'hover:bg-slate-800/45'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTrack(track, displayedTracks)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                    {track.artwork ? (
                      <img
                        src={track.artwork}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-amber-400/80">
                        <Disc3 className="h-5 w-5" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <Play className="h-4 w-4 fill-amber-400 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm font-semibold ${
                        isCurrent ? 'text-amber-300' : 'text-slate-100'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {track.artist} · {formatDuration(track.duration)} ·{' '}
                      {track.source === 'local'
                        ? track.tags?.[1] || 'Local'
                        : track.source === 'audius'
                          ? 'Full'
                          : track.source === 'archive'
                            ? 'Archive'
                            : '30s Preview'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(track)}
                  aria-label={
                    isFav
                      ? `Remove ${track.title} from Mixtape`
                      : `Save ${track.title} to Mixtape`
                  }
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      isFav ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
