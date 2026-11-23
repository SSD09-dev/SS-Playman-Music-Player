import React from 'react';
import type { DeckState, TapeSide, Track } from '../types/music';

interface LcdDisplayProps {
  track: Track | null;
  deckState: DeckState;
  side: TapeSide;
  sideTrackIndex: number; // 1..6
  currentTime: number;
  duration: number;
  showBootSplash: boolean;
  onSeek: (time: number) => void;
  statusBanner?: string | null;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getCleanTrackTitle(rawTitle: string, rawArtist?: string): string {
  const title = rawTitle.trim();
  const dashMatch = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!dashMatch) return title;

  const prefix = dashMatch[1].trim();
  const rest = dashMatch[2].trim();
  if (!rest) return title;

  const normPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normArtist = (rawArtist || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (
    !normArtist ||
    normArtist === 'independentartist' ||
    normArtist === 'unknownartist' ||
    normArtist.includes(normPrefix) ||
    normPrefix.includes(normArtist)
  ) {
    return rest;
  }

  return title;
}

export const LcdDisplay: React.FC<LcdDisplayProps> = ({
  track,
  deckState,
  side,
  sideTrackIndex,
  currentTime,
  duration,
  showBootSplash,
  onSeek,
  statusBanner,
}) => {
  const safeDuration = duration > 0 ? duration : track?.duration || 1;
  const pct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  const cleanTitle = track ? getCleanTrackTitle(track.title, track.artist) : '';

  const stateWord =
    deckState === 'playing'
      ? 'PLAY ►'
      : deckState === 'paused'
        ? 'PAUSE ❚❚'
        : 'STOP ■';

  return (
    <div className="rounded-xl border border-black/80 bg-[#0d1016] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
      <div className="lcd-panel-amber relative overflow-hidden rounded-lg border border-black/60 px-3.5 py-3">
        {/* Subtle dot-matrix grid overlay */}
        <div className="lcd-dot-grid pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative z-10 flex flex-col gap-2">
          {/* Top LCD Telemetry Line (Single horizontal row, no wrapping) */}
          <div className="flex items-center justify-between gap-2 font-mono-lcd text-[11px] font-semibold tracking-wider">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 whitespace-nowrap rounded border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.5 leading-none text-amber-200">
                SIDE {side}
              </span>
              <span className="shrink-0 whitespace-nowrap text-amber-300">
                TRACK {String(sideTrackIndex).padStart(2, '0')}/06
              </span>
            </div>

            <span className="shrink-0 whitespace-nowrap text-amber-500/80">
              {stateWord}
            </span>
          </div>

          {/* Main Dot-Matrix Readout */}
          {showBootSplash ? (
            <div className="flex h-[54px] flex-col items-center justify-center text-center">
              <div className="font-mono-lcd text-xl font-bold tracking-[0.28em] text-amber-300">
                SS PLAYMAN
              </div>
              <div className="font-mono-lcd mt-0.5 text-[10px] tracking-[0.18em] text-amber-500/70">
                AUTO-REVERSE CASSETTE DECK
              </div>
            </div>
          ) : statusBanner ? (
            <div className="flex h-[54px] flex-col items-center justify-center text-center">
              <div className="font-mono-lcd text-sm font-bold tracking-[0.14em] text-amber-300">
                {statusBanner}
              </div>
              <div className="font-mono-lcd mt-0.5 max-w-full truncate text-[11px] text-amber-500/75">
                {track ? `${cleanTitle} — ${track.artist}` : 'READY'}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[54px] flex-col justify-center">
              <div className="font-mono-lcd truncate text-sm font-bold tracking-wide text-amber-300 sm:text-base">
                {track ? cleanTitle.toUpperCase() : 'NO CASSETTE LOADED'}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-3 font-mono-lcd text-xs">
                <span className="truncate text-amber-500/75">
                  {track ? track.artist : 'SEARCH OR ENTER SSP CODE'}
                </span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-amber-300">
                  {formatClock(currentTime)} / {formatClock(safeDuration)}
                </span>
              </div>
            </div>
          )}

          {/* Full-Width Segmented Tape Progress Scrubber */}
          <div className="pt-0.5">
            <div className="relative h-2.5 w-full overflow-hidden rounded-sm border border-black/50 bg-amber-950/80">
              <div
                className="h-full bg-amber-400 transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.5}
                value={Math.min(currentTime, safeDuration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                disabled={!track}
                aria-label="Seek tape position"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
