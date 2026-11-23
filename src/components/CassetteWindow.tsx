import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Disc3 } from 'lucide-react';
import type { DeckState, TapeSide, Track } from '../types/music';

interface CassetteWindowProps {
  track: Track | null;
  deckState: DeckState;
  side: TapeSide;
  progressPct: number; // 0..100
  isAutoReversing: boolean;
  swapCount: number;
}

const THEME_BANDS: Record<
  NonNullable<Track['cassetteTheme']>,
  { band: string; stripe: string; badge: string }
> = {
  amber: {
    band: 'bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#d97706]',
    stripe: 'bg-amber-900/20',
    badge: 'bg-[#1f242d] text-amber-300',
  },
  cobalt: {
    band: 'bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0284c7]',
    stripe: 'bg-blue-950/20',
    badge: 'bg-[#172033] text-sky-300',
  },
  crimson: {
    band: 'bg-gradient-to-r from-[#be123c] via-[#e11d48] to-[#dc2626]',
    stripe: 'bg-rose-950/20',
    badge: 'bg-[#2a1219] text-rose-200',
  },
  olive: {
    band: 'bg-gradient-to-r from-[#3f6212] via-[#65a30d] to-[#4d7c0f]',
    stripe: 'bg-lime-950/20',
    badge: 'bg-[#1a2611] text-lime-200',
  },
  chrome: {
    band: 'bg-gradient-to-r from-[#475569] via-[#64748b] to-[#334155]',
    stripe: 'bg-slate-900/20',
    badge: 'bg-[#11151d] text-slate-200',
  },
};

interface ReelHubProps {
  spinning: boolean;
  fast?: boolean;
  tapeRadiusScale: number; // 0.7..1.35
}

const ReelHub: React.FC<ReelHubProps> = ({
  spinning,
  fast = false,
  tapeRadiusScale,
}) => {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
      {/* Magnetic tape wound around hub */}
      <div
        className="absolute rounded-full bg-[#1a1412] shadow-[inset_0_0_6px_rgba(0,0,0,0.9)] transition-transform duration-300"
        style={{
          width: '66px',
          height: '66px',
          transform: `scale(${tapeRadiusScale})`,
          background:
            'repeating-radial-gradient(circle, #211915 0px, #211915 2px, #140f0d 2px, #140f0d 4px)',
        }}
      />
      {/* Rotating toothed white hub */}
      <div
        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 bg-[#eceff4] shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:h-11 sm:w-11 ${
          fast ? 'reel-spinning-fast' : spinning ? 'reel-spinning' : ''
        }`}
      >
        <div className="h-5 w-5 rounded-full bg-[#14171f] shadow-inner" />
        {/* 6 sprocket teeth */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <span
            key={deg}
            className="absolute h-2 w-1 bg-[#14171f]"
            style={{
              transform: `rotate(${deg}deg) translateY(-10px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface CassetteFaceProps {
  track: Track | null;
  faceSide: TapeSide;
  spinning: boolean;
  fastSpin: boolean;
  leftTapeScale: number;
  rightTapeScale: number;
  isBackFace?: boolean;
}

const CassetteFace: React.FC<CassetteFaceProps> = ({
  track,
  faceSide,
  spinning,
  fastSpin,
  leftTapeScale,
  rightTapeScale,
  isBackFace = false,
}) => {
  const theme = THEME_BANDS[track?.cassetteTheme || 'amber'];
  const isSideB = faceSide === 'B';

  return (
    <div
      className={`backface-hidden absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl border border-slate-500/40 bg-gradient-to-b from-[#2b303a] via-[#1f242c] to-[#161a21] p-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] ${
        isBackFace ? '[transform:rotateY(180deg)]' : ''
      }`}
    >
      {/* Corner cassette housing screws */}
      <div className="pointer-events-none absolute top-1.5 left-1.5 h-2 w-2 rounded-full border border-slate-600 bg-slate-400/70" />
      <div className="pointer-events-none absolute top-1.5 right-1.5 h-2 w-2 rounded-full border border-slate-600 bg-slate-400/70" />
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full border border-slate-600 bg-slate-400/70" />
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full border border-slate-600 bg-slate-400/70" />

      {/* Paper Sticker Label */}
      <div className="relative mx-2 mt-1 overflow-hidden rounded-md border border-black/40 bg-[#f6f1e4] shadow-inner">
        {/* Top cream title area */}
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          {track?.artwork ? (
            <img
              src={track.artwork}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 rounded-sm border border-slate-400/60 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-slate-800 text-amber-400">
              <Disc3 className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-extrabold uppercase tracking-wide text-[#181c24] sm:text-base">
              {track ? track.title : 'SS PLAYMAN DEMO TAPE'}
            </div>
            <div className="truncate text-[11px] font-semibold text-slate-600">
              {track ? track.artist : 'Insert track from catalog or SSP code'}
            </div>
          </div>

          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded font-display text-base font-extrabold tracking-tight ${
              isSideB ? 'bg-amber-600 text-white' : theme.badge
            }`}
          >
            {faceSide}
          </div>
        </div>

        {/* Colored retro stripe */}
        <div className={`flex items-center justify-between px-2.5 py-0.5 text-[9px] font-bold tracking-[0.16em] text-white/95 ${theme.band}`}>
          <span>SS-90 CrO2 HIGH BIAS</span>
          <span>SIDE {faceSide} · STEREO</span>
        </div>

        {/* Transparent Reel Bridge Window inside Label */}
        <div className="relative mx-auto my-2 flex h-[64px] w-[88%] items-center justify-between overflow-hidden rounded-md border border-slate-700/90 bg-[#10131a] px-4 shadow-[inset_0_2px_8px_rgba(0,0,0,0.95)] sm:h-[70px]">
          {/* Horizontal tape-counter tick marks */}
          <div className="pointer-events-none absolute inset-x-16 top-1/2 flex -translate-y-1/2 items-center justify-between px-2 opacity-40">
            {[0, 1, 2, 3, 4].map((tick) => (
              <span key={tick} className="h-2.5 w-[1px] bg-amber-300" />
            ))}
          </div>

          <ReelHub
            spinning={spinning}
            fast={fastSpin}
            tapeRadiusScale={leftTapeScale}
          />
          <ReelHub
            spinning={spinning}
            fast={fastSpin}
            tapeRadiusScale={rightTapeScale}
          />
        </div>
      </div>

      {/* Bottom Trapezoid Capstan & Magnetic Head Shield */}
      <div className="mx-auto mt-1 flex h-6 w-[66%] items-center justify-around rounded-t-md border-t border-x border-slate-600/50 bg-[#13161d] px-4 shadow-inner">
        <span className="h-2.5 w-2.5 rounded-full border border-slate-500 bg-black" />
        <span className="h-2 w-8 rounded-xs bg-amber-600/40" />
        <span className="h-2.5 w-2.5 rounded-full border border-slate-500 bg-black" />
      </div>
    </div>
  );
};

export const CassetteWindow: React.FC<CassetteWindowProps> = ({
  track,
  deckState,
  side,
  progressPct,
  isAutoReversing,
  swapCount,
}) => {
  const isPlaying = deckState === 'playing';
  const clampedPct = Math.max(0, Math.min(100, progressPct)) / 100;
  // On Side A, left reel depletes and right reel fills; on Side B, reversed!
  const leftTapeScale =
    side === 'A' ? 1.08 - clampedPct * 0.3 : 0.78 + clampedPct * 0.3;
  const rightTapeScale =
    side === 'A' ? 0.78 + clampedPct * 0.3 : 1.08 - clampedPct * 0.3;

  // Key changes ONLY when a new song swaps in (swapCount), NOT on flip, so flip animates rotateY smoothly in place!
  const cassetteKey = `${track?.id || 'empty'}-${swapCount}`;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-[#0c0e13] bg-[#0e1118] p-3 shadow-[inset_0_6px_18px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.16)]">
      {/* Recessed bay background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.04),transparent_70%)]" />

      {/* Auto-reverse status indicator on window bezel */}
      <div className="relative z-20 mb-2 flex items-center justify-between px-1">
        <span className="font-mono-lcd text-[10px] font-semibold tracking-[0.18em] text-slate-400">
          TAPE BAY ·{' '}
          {track
            ? track.source === 'local'
              ? 'LOCAL TAPE'
              : track.source === 'itunes'
                ? 'PREVIEW 30S'
                : 'FULL STREAM'
            : 'EMPTY'}
        </span>
        <span
          className={`font-mono-lcd text-[10px] font-bold tracking-[0.15em] transition-colors ${
            isAutoReversing
              ? 'text-amber-400'
              : 'text-slate-500'
          }`}
        >
          {isAutoReversing ? '⇄ AUTO-REVERSING SIDE...' : `AUTO-REVERSE ⇄ SIDE ${side}`}
        </span>
      </div>

      {/* Cassette Stage with 3D perspective */}
      <div className="perspective-1200 relative mx-auto h-[182px] w-full max-w-[340px] sm:h-[196px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={cassetteKey}
            initial={{ y: -155, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -155, opacity: 0, scale: 0.92 }}
            transition={{
              duration: 0.34,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="h-full w-full"
          >
            {/* 3D Flipper shell for Side A <-> Side B Auto-Reverse */}
            <motion.div
              animate={{
                rotateY: side === 'B' ? 180 : 0,
                scale: isAutoReversing ? [1, 1.05, 1] : 1,
              }}
              transition={{
                rotateY: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 0.65 },
              }}
              className="preserve-3d relative h-full w-full"
            >
              <CassetteFace
                track={track}
                faceSide="A"
                spinning={isPlaying}
                fastSpin={isAutoReversing}
                leftTapeScale={leftTapeScale}
                rightTapeScale={rightTapeScale}
              />
              <CassetteFace
                track={track}
                faceSide="B"
                spinning={isPlaying}
                fastSpin={isAutoReversing}
                leftTapeScale={leftTapeScale}
                rightTapeScale={rightTapeScale}
                isBackFace
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Smoked Acrylic Glass Specular Reflection Overlay */}
      <div className="pointer-events-none absolute inset-0 z-30 rounded-xl bg-gradient-to-br from-white/[0.08] via-transparent to-black/25" />
    </div>
  );
};
