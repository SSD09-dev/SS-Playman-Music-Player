import React from 'react';
import {
  FastForward,
  Pause,
  Play,
  RefreshCw,
  Rewind,
  Square,
} from 'lucide-react';
import type { DeckState, TapeSide } from '../types/music';

interface PianoKeysProps {
  deckState: DeckState;
  side: TapeSide;
  disabled: boolean;
  onRew: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onFf: () => void;
  onFlipSide: () => void;
}

export const PianoKeys: React.FC<PianoKeysProps> = ({
  deckState,
  side,
  disabled,
  onRew,
  onPlay,
  onPause,
  onStop,
  onFf,
  onFlipSide,
}) => {
  const isPlaying = deckState === 'playing';
  const isPaused = deckState === 'paused';

  const baseKeyClass =
    'group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-b-lg rounded-t-sm border-x border-b border-t transition-all duration-100 select-none focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-45 disabled:cursor-not-allowed';

  const unlatchedKeyClass =
    'border-t-[#e5e9f0] border-x-[#6f7785] border-b-[#1f242d] bg-gradient-to-b from-[#d8dde6] via-[#bcc4d0] to-[#98a2b0] text-[#171b22] shadow-[0_6px_0_#2b313c,0_8px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.85)] active:translate-y-[4px] active:shadow-[0_2px_0_#2b313c,0_3px_6px_rgba(0,0,0,0.5)]';

  const latchedKeyClass =
    'translate-y-[4px] border-t-[#5c6472] border-x-[#454c58] border-b-[#161920] bg-gradient-to-b from-[#98a1ae] via-[#8993a2] to-[#798392] text-[#0f131a] shadow-[0_2px_0_#1f242d,inset_0_3px_6px_rgba(0,0,0,0.35)]';

  return (
    <div className="rounded-xl border border-black/80 bg-[#12151c] p-2 shadow-[inset_0_3px_8px_rgba(0,0,0,0.85)]">
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2 pb-1">
        {/* REW */}
        <button
          type="button"
          disabled={disabled}
          onClick={onRew}
          aria-label="Rewind / Previous Track"
          className={`${baseKeyClass} ${unlatchedKeyClass}`}
        >
          <Rewind className="h-4 w-4 fill-current sm:h-[18px] sm:w-[18px]" />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            REW
          </span>
        </button>

        {/* PLAY (Latching) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onPlay}
          aria-pressed={isPlaying}
          aria-label="Play Cassette"
          className={`${baseKeyClass} ${
            isPlaying ? latchedKeyClass : unlatchedKeyClass
          }`}
        >
          {isPlaying && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
          )}
          <Play
            className={`h-4 w-4 fill-current sm:h-[18px] sm:w-[18px] ${
              isPlaying ? 'text-amber-700' : ''
            }`}
          />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            PLAY
          </span>
        </button>

        {/* PAUSE (Latching toggle) */}
        <button
          type="button"
          disabled={disabled || deckState === 'stopped'}
          onClick={onPause}
          aria-pressed={isPaused}
          aria-label="Pause Cassette"
          className={`${baseKeyClass} ${
            isPaused ? latchedKeyClass : unlatchedKeyClass
          }`}
        >
          {isPaused && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
          )}
          <Pause className="h-4 w-4 fill-current sm:h-[18px] sm:w-[18px]" />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            PAUSE
          </span>
        </button>

        {/* STOP */}
        <button
          type="button"
          disabled={disabled}
          onClick={onStop}
          aria-label="Stop Cassette"
          className={`${baseKeyClass} ${unlatchedKeyClass}`}
        >
          <Square className="h-4 w-4 fill-current sm:h-[18px] sm:w-[18px]" />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            STOP
          </span>
        </button>

        {/* FF */}
        <button
          type="button"
          disabled={disabled}
          onClick={onFf}
          aria-label="Fast Forward / Next Track"
          className={`${baseKeyClass} ${unlatchedKeyClass}`}
        >
          <FastForward className="h-4 w-4 fill-current sm:h-[18px] sm:w-[18px]" />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            FF
          </span>
        </button>

        {/* DIR / FLIP */}
        <button
          type="button"
          disabled={disabled}
          onClick={onFlipSide}
          aria-label={`Flip tape side (currently Side ${side})`}
          className={`${baseKeyClass} border-t-[#ffb366] border-x-[#944d15] border-b-[#3b1c04] bg-gradient-to-b from-[#ff8f32] via-[#e66f17] to-[#c45608] text-[#170c02] shadow-[0_6px_0_#4a2305,0_8px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.55)] active:translate-y-[4px] active:shadow-[0_2px_0_#4a2305,0_3px_6px_rgba(0,0,0,0.5)]`}
        >
          <RefreshCw className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          <span className="font-display text-[10px] font-bold tracking-wider sm:text-[11px]">
            DIR {side}
          </span>
        </button>
      </div>
    </div>
  );
};
