import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  FolderUp,
  Heart,
  Link2,
  ListMusic,
  Loader2,
  QrCode,
  Search,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CassetteWindow } from './components/CassetteWindow';
import { LcdDisplay } from './components/LcdDisplay';
import { MixtapeShelf } from './components/MixtapeShelf';
import { MusicNoteQRCard } from './components/MusicNoteQRCard';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { PianoKeys } from './components/PianoKeys';
import { SearchCatalog } from './components/SearchCatalog';
import { SingerInfoDrawer } from './components/SingerInfoDrawer';
import { fetchStarterPlaylist, resolveSongCode } from './services/musicApi';
import type { DeckState, TapeSide, Track } from './types/music';
import { createLocalTracksFromFiles, probeAudioDuration } from './utils/localTape';
import { extractSongCodeFromInput } from './utils/songCode';
import {
  bindFirstTapAudioUnlock,
  playAutoReverseFlipSfx,
  playCassetteSwapSfx,
  playMechanicalClick,
} from './utils/soundFx';
import {
  type TasteMap,
  loadTasteMap,
  recordSingerTaste,
} from './utils/tasteTracker';

const FAVORITES_STORAGE_KEY = 'ss_playman_favorites_v1';
const SFX_STORAGE_KEY = 'ss_playman_sfx_v1';

type StudioTab = 'catalog' | 'mixtape' | 'share';

export default function App() {
  // Playlist & active track state
  const [queue, setQueue] = useState<Track[]>([]);
  const [starterTracks, setStarterTracks] = useState<Track[]>([]);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [deckState, setDeckState] = useState<DeckState>('stopped');

  // Tape side & 6-song Auto-Reverse counter
  const [side, setSide] = useState<TapeSide>('A');
  const [sideTrackIndex, setSideTrackIndex] = useState<number>(1);
  const [swapCount, setSwapCount] = useState<number>(0);
  const [isAutoReversing, setIsAutoReversing] = useState<boolean>(false);

  // Audio playback metrics
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SFX_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showBootSplash, setShowBootSplash] = useState<boolean>(true);
  const [lcdBanner, setLcdBanner] = useState<string | null>(null);

  // Battery API state (real hardware reading when supported)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // Favorites Mixtape Shelf (persisted in localStorage; filter expired blob URLs on boot)
  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((t: Track) => t && t.source !== 'local')
        : [];
    } catch {
      return [];
    }
  });

  // Per-device personalized taste counts (persisted privately in localStorage)
  const [tasteMap, setTasteMap] = useState<TasteMap>(() => loadTasteMap());

  // UI Drawers & Tabs
  const [activeTab, setActiveTab] = useState<StudioTab>('catalog');
  const [singerDrawerTrack, setSingerDrawerTrack] = useState<Track | null>(null);
  const [qrModalTrack, setQrModalTrack] = useState<Track | null>(null);

  // Top "Enter Code / Paste Song Link" bar
  const [codeInput, setCodeInput] = useState<string>('');
  const [codeLoading, setCodeLoading] = useState<boolean>(false);
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localObjectUrlsRef = useRef<string[]>([]);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<number | null>(null);
  const recordedPlayKeyRef = useRef<string>('');

  const favoriteIds = useMemo(
    () => new Set(favorites.map((t) => t.id)),
    [favorites]
  );

  const recordTaste = useCallback((singerOrTerm: string, weight = 1) => {
    setTasteMap((prev) => recordSingerTaste(prev, singerOrTerm, weight));
  }, []);

  const flashBanner = useCallback((msg: string, durationMs = 1600) => {
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }
    setLcdBanner(msg);
    bannerTimerRef.current = window.setTimeout(() => {
      setLcdBanner(null);
    }, durationMs);
  }, []);

  // Persist non-local favorites (blob URLs are session-scoped)
  useEffect(() => {
    try {
      const persistable = favorites.filter((t) => t.source !== 'local');
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // Storage quota ignored
    }
  }, [favorites]);

  // Revoke any active local blob URLs on unmount
  useEffect(() => {
    return () => {
      localObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localObjectUrlsRef.current = [];
    };
  }, []);

  // Persist SFX ON/OFF preference
  useEffect(() => {
    try {
      localStorage.setItem(SFX_STORAGE_KEY, String(sfxEnabled));
    } catch {
      // Storage ignored
    }
  }, [sfxEnabled]);

  // Record singer interest whenever a track is actively played on this device
  useEffect(() => {
    if (deckState === 'playing' && currentTrack) {
      const playKey = `${currentTrack.id}:${swapCount}`;
      if (recordedPlayKeyRef.current !== playKey) {
        recordedPlayKeyRef.current = playKey;
        recordTaste(currentTrack.artist, 2);
      }
    }
  }, [currentTrack, deckState, recordTaste, swapCount]);

  // Startup LCD splash timer + first-tap AudioContext unlock + optional Battery API
  useEffect(() => {
    bindFirstTapAudioUnlock();
    const t = window.setTimeout(() => setShowBootSplash(false), 1700);
    const nav = navigator as unknown as {
      getBattery?: () => Promise<{ level: number; addEventListener: (e: string, cb: () => void) => void }>;
    };
    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((bat) => {
          setBatteryLevel(Math.round(bat.level * 100));
          bat.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(bat.level * 100));
          });
        })
        .catch(() => {});
    }
    return () => window.clearTimeout(t);
  }, []);

  // Load starter playlist & check URL ?code=SSP-... on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code');

      const [starter, sharedTrack] = await Promise.all([
        fetchStarterPlaylist(),
        urlCode ? resolveSongCode(urlCode) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      setStarterTracks(starter);

      if (sharedTrack) {
        const merged = [
          sharedTrack,
          ...starter.filter((t) => t.id !== sharedTrack.id),
        ];
        setQueue(merged);
        setCurrentTrack(sharedTrack);
        setSwapCount((c) => c + 1);
        shouldAutoPlayRef.current = true;
        flashBanner('SHARED CASSETTE LOADED', 2200);
      } else if (starter.length > 0) {
        setQueue(starter);
        setCurrentTrack(starter[0]);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [flashBanner]);

  // Sync volume to <audio>
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Load audio source whenever currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
    audio.src = currentTrack.streamUrl;
    audio.load();

    if (shouldAutoPlayRef.current) {
      audio
        .play()
        .then(() => {
          setDeckState('playing');
        })
        .catch(() => {
          setDeckState('paused');
          flashBanner('TAP PLAY ► TO START TAPE', 2400);
        });
    }
  }, [currentTrack, flashBanner]);

  // Trigger physical 3D Auto-Reverse Flip animation
  const triggerFlip = useCallback(
    (nextSide: TapeSide, bannerText?: string) => {
      playAutoReverseFlipSfx(sfxEnabled);
      setIsAutoReversing(true);
      setSide(nextSide);
      flashBanner(bannerText || `AUTO-REVERSE ⇄ SIDE ${nextSide}`, 1600);
      window.setTimeout(() => {
        setIsAutoReversing(false);
      }, 750);
    },
    [flashBanner, sfxEnabled]
  );

  // Play a specific track with mechanical cassette swap
  const loadAndPlayTrack = useCallback(
    (track: Track, newQueue?: Track[], resetSideCounter = false) => {
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      } else if (!queue.some((q) => q.id === track.id)) {
        setQueue((prev) => [track, ...prev]);
      }

      const isDifferent = currentTrack?.id !== track.id;
      if (isDifferent) {
        playCassetteSwapSfx(sfxEnabled);
        setSwapCount((c) => c + 1);
      } else {
        playMechanicalClick('latch', sfxEnabled);
      }

      if (resetSideCounter) {
        setSideTrackIndex(1);
      }

      shouldAutoPlayRef.current = true;
      setCurrentTrack(track);
      setDeckState('playing');
    },
    [currentTrack?.id, queue, sfxEnabled]
  );

  // Advance to next track (handles 6-song Auto-Reverse Side A <-> Side B!)
  const handleNextTrack = useCallback(
    (fromManualFf = false) => {
      const activeList = queue.length > 0 ? queue : starterTracks;
      if (activeList.length === 0) return;

      const currentIdx = currentTrack
        ? activeList.findIndex((t) => t.id === currentTrack.id)
        : -1;
      const nextIdx = (currentIdx + 1) % activeList.length;
      const nextTrack = activeList[nextIdx];

      shouldAutoPlayRef.current = true;

      if (sideTrackIndex >= 6) {
        // 6th song finished -> Auto-Reverse Flip from SIDE A <-> SIDE B seamlessly!
        const nextSide: TapeSide = side === 'A' ? 'B' : 'A';
        setSideTrackIndex(1);
        triggerFlip(nextSide, `6TH TRACK DONE · FLIP TO SIDE ${nextSide}`);
        setCurrentTrack(nextTrack);
        setDeckState('playing');
      } else {
        setSideTrackIndex((n) => n + 1);
        if (fromManualFf) {
          playMechanicalClick('ff', sfxEnabled);
        } else {
          playCassetteSwapSfx(sfxEnabled);
        }
        setSwapCount((c) => c + 1);
        setCurrentTrack(nextTrack);
        setDeckState('playing');
      }
    },
    [currentTrack, queue, sfxEnabled, side, sideTrackIndex, starterTracks, triggerFlip]
  );

  // Previous / Rewind track
  const handlePrevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      playMechanicalClick('rew', sfxEnabled);
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const activeList = queue.length > 0 ? queue : starterTracks;
    if (activeList.length === 0) return;

    const currentIdx = currentTrack
      ? activeList.findIndex((t) => t.id === currentTrack.id)
      : 0;
    const prevIdx = (currentIdx - 1 + activeList.length) % activeList.length;
    const prevTrack = activeList[prevIdx];

    playMechanicalClick('rew', sfxEnabled);
    setSideTrackIndex((n) => (n > 1 ? n - 1 : 6));
    setSwapCount((c) => c + 1);
    shouldAutoPlayRef.current = true;
    setCurrentTrack(prevTrack);
    setDeckState('playing');
  }, [currentTrack, queue, sfxEnabled, starterTracks]);

  // Transport controls
  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!currentTrack || !audio) return;
    playMechanicalClick('latch', sfxEnabled);
    shouldAutoPlayRef.current = true;
    audio
      .play()
      .then(() => setDeckState('playing'))
      .catch(() => {
        flashBanner('STREAM LOAD ERROR · TRY NEXT', 1800);
      });
  }, [currentTrack, flashBanner, sfxEnabled]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || deckState === 'stopped') return;
    if (deckState === 'playing') {
      playMechanicalClick('latch', sfxEnabled);
      audio.pause();
      setDeckState('paused');
    } else {
      handlePlay();
    }
  }, [deckState, handlePlay, sfxEnabled]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    playMechanicalClick('stop', sfxEnabled);
    shouldAutoPlayRef.current = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTime(0);
    setDeckState('stopped');
  }, [sfxEnabled]);

  const handleManualFlip = useCallback(() => {
    const nextSide: TapeSide = side === 'A' ? 'B' : 'A';
    triggerFlip(nextSide, `MANUAL FLIP ⇄ SIDE ${nextSide}`);
  }, [side, triggerFlip]);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleToggleFavorite = useCallback(
    (track: Track) => {
      const isAlreadyFav = favoriteIds.has(track.id);
      if (!isAlreadyFav) {
        recordTaste(track.artist, 3);
      }
      setFavorites((prev) => {
        const exists = prev.some((t) => t.id === track.id);
        if (exists) {
          return prev.filter((t) => t.id !== track.id);
        }
        return [track, ...prev];
      });
    },
    [favoriteIds, recordTaste]
  );

  // Load Local Audio Files (.mp3, .m4a, .wav, .flac, .ogg) with memory-safe URL cleanup
  const triggerLocalFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoadLocalFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const { tracks, objectUrls } = createLocalTracksFromFiles(files);
      // Reset input value so the same files can be re-selected later if desired
      e.target.value = '';

      if (tracks.length === 0) {
        flashBanner('NO VALID AUDIO FILES SELECTED', 2000);
        return;
      }

      // Stop current audio element before revoking previous object URLs
      const audio = audioRef.current;
      if (audio && currentTrack?.source === 'local') {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }

      // Revoke all previously created local object URLs to prevent memory leaks
      localObjectUrlsRef.current.forEach((oldUrl) => URL.revokeObjectURL(oldUrl));
      localObjectUrlsRef.current = objectUrls;

      // Remove any stale in-session local tracks from favorites whose URLs were just revoked
      setFavorites((prev) => prev.filter((t) => t.source !== 'local'));

      setLocalTracks(tracks);
      setSide('A');
      setSideTrackIndex(1);
      setActiveTab('mixtape');
      flashBanner(`MY TAPE · ${tracks.length} FILE${tracks.length > 1 ? 'S' : ''} LOADED`, 2000);
      loadAndPlayTrack(tracks[0], tracks, true);

      // Probe durations in the background for accurate list lengths
      tracks.forEach((track) => {
        probeAudioDuration(track.streamUrl).then((dur) => {
          if (dur <= 0 || !localObjectUrlsRef.current.includes(track.streamUrl)) {
            return;
          }
          setLocalTracks((prev) =>
            prev.map((item) =>
              item.id === track.id ? { ...item, duration: dur } : item
            )
          );
          setQueue((prev) =>
            prev.map((item) =>
              item.id === track.id ? { ...item, duration: dur } : item
            )
          );
          setCurrentTrack((prev) =>
            prev && prev.id === track.id ? { ...prev, duration: dur } : prev
          );
        });
      });
    },
    [currentTrack?.source, flashBanner, loadAndPlayTrack]
  );

  // Load Song from SSP-... code or shared link
  const handleLoadCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractSongCodeFromInput(codeInput);
    if (!extracted) {
      setCodeFeedback('Enter a valid SSP-... code or SS Playman share link.');
      return;
    }

    setCodeLoading(true);
    setCodeFeedback(null);
    try {
      const resolved = await resolveSongCode(extracted);
      if (!resolved) {
        setCodeFeedback('Could not locate that song on public catalogs.');
        return;
      }
      setCodeInput('');
      setCodeFeedback(`Loaded "${resolved.title}"`);
      window.setTimeout(() => setCodeFeedback(null), 2500);
      loadAndPlayTrack(resolved, undefined, true);
    } catch {
      setCodeFeedback('Network error resolving song code.');
    } finally {
      setCodeLoading(false);
    }
  };

  // Native Android / Lock-Screen Media Session Integration
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: `${currentTrack.album || 'SS Playman'} · Side ${side}`,
        artwork: currentTrack.artwork
          ? [
              { src: currentTrack.artwork, sizes: '256x256', type: 'image/jpeg' },
              { src: currentTrack.artwork, sizes: '512x512', type: 'image/jpeg' },
            ]
          : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
    }

    navigator.mediaSession.playbackState =
      deckState === 'playing'
        ? 'playing'
        : deckState === 'paused'
          ? 'paused'
          : 'none';

    const safeSetHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action ignored
      }
    };

    safeSetHandler('play', handlePlay);
    safeSetHandler('pause', handlePause);
    safeSetHandler('stop', handleStop);
    safeSetHandler('previoustrack', handlePrevTrack);
    safeSetHandler('nexttrack', () => handleNextTrack(false));
    safeSetHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        handleSeek(details.seekTime);
      }
    });
  }, [
    currentTrack,
    deckState,
    handleNextTrack,
    handlePause,
    handlePlay,
    handlePrevTrack,
    handleSeek,
    handleStop,
    side,
  ]);

  const safeDuration = duration > 0 ? duration : currentTrack?.duration || 1;
  const progressPct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));
  const isCurrentFav = currentTrack ? favoriteIds.has(currentTrack.id) : false;

  return (
    <div className="min-h-screen bg-[#11141b] text-slate-100 selection:bg-amber-500/30">
      {/* Hidden multi-file local audio picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg"
        multiple
        onChange={handleLoadLocalFiles}
        className="hidden"
        aria-hidden="true"
      />

      {/* Hidden native HTML5 Audio engine */}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration;
          if (Number.isFinite(dur) && dur > 0) setDuration(dur);
        }}
        onEnded={() => handleNextTrack(false)}
        onError={() => {
          if (currentTrack) {
            flashBanner('STREAM BLOCKED · NEXT TAPE', 1500);
            window.setTimeout(() => handleNextTrack(), 900);
          }
        }}
      />

      {/* Top Bar: Brand + Paste SSP Code / Link + PWA Install */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#141821]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <img
              src="/chip-emblem.png"
              alt="SS Playman steel emblem"
              className="h-9 w-9 rounded-md object-cover shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
            />
            <span className="font-display text-xl font-extrabold tracking-[0.14em] uppercase text-white">
              SS Playman
            </span>
          </div>

          <form
            onSubmit={handleLoadCode}
            className="order-3 flex w-full items-center gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:max-w-md"
          >
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Enter SSP-... code or paste song link"
                aria-label="Enter SSP code or paste song link"
                className="min-h-[42px] w-full rounded-lg border border-slate-700 bg-[#0d1016] pr-3 pl-9 font-mono-lcd text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={codeLoading || !codeInput.trim()}
              className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-45"
            >
              {codeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>Load</span>
              )}
            </button>
          </form>

          <div className="order-2 flex items-center gap-2 sm:order-3 shrink-0">
            <PWAInstallButton />
          </div>
        </div>

        {codeFeedback && (
          <div className="border-t border-slate-800/80 bg-[#181d27] px-4 py-1.5 text-center text-xs font-medium text-amber-300">
            {codeFeedback}
          </div>
        )}
      </header>

      {/* Main Studio Workbench: Walkman Deck + Catalog / Mixtape / Share Studio */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-12 lg:items-start lg:py-8">
        {/* LEFT COLUMN: Skeuomorphic SS PLAYMAN Walkman Hardware Deck */}
        <section
          aria-label="SS Playman Cassette Player"
          className="lg:col-span-5"
        >
          <div className="relative overflow-hidden rounded-[26px] border border-slate-600/50 bg-[#1b2029] p-3 shadow-[0_24px_50px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.2)] sm:p-4">
            {/* TOP BRUSHED-ALUMINUM CHASSIS PLATE WITH STAMPED BRANDING */}
            <div className="brushed-metal relative overflow-hidden rounded-t-2xl rounded-b-lg border border-slate-400/70 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.45)] sm:px-4">
              {/* Top corner chassis screws */}
              <span className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full border border-slate-500 bg-slate-300 shadow-inner" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full border border-slate-500 bg-slate-300 shadow-inner" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <img
                    src="/chip-emblem.png"
                    alt="SS Playman emblem"
                    className="h-[42px] w-[42px] shrink-0 rounded-[8px] object-cover drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
                    <h1 className="font-display engraved-stamp truncate whitespace-nowrap text-[clamp(16px,4.5vw,21px)] leading-none font-extrabold tracking-[0.12em] uppercase">
                      SS PLAYMAN
                    </h1>
                    <p className="engraved-sub mt-[3px] truncate whitespace-nowrap text-[clamp(7.5px,2vw,9.5px)] leading-none font-bold tracking-[0.08em] uppercase opacity-75">
                      AUTO-REVERSE STEREO PLAYER
                    </p>
                  </div>
                </div>

                {/* Power & Battery Hardware LED Indicator */}
                <div className="flex shrink-0 items-center">
                  <div className="flex items-center gap-1.5 rounded border border-slate-500/60 bg-[#1e232c] px-2 py-1 shadow-inner">
                    <span
                      className={`h-2 w-2 rounded-full transition-all ${
                        deckState === 'playing'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : deckState === 'paused'
                            ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                            : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                      }`}
                    />
                    <span className="font-mono-lcd whitespace-nowrap text-[10px] leading-none font-bold tracking-wider text-slate-200">
                      {batteryLevel !== null ? `BAT ${batteryLevel}%` : 'OPR/BATT'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE MATTE CHARCOAL CASSETTE & LCD CHASSIS */}
            <div className="brushed-metal-dark mt-2.5 flex flex-col gap-3 rounded-xl border border-black/70 p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]">
              {/* Glowing Retro Dot-Matrix LCD Readout */}
              <LcdDisplay
                track={currentTrack}
                deckState={deckState}
                side={side}
                sideTrackIndex={sideTrackIndex}
                currentTime={currentTime}
                duration={duration}
                showBootSplash={showBootSplash}
                onSeek={handleSeek}
                statusBanner={lcdBanner}
              />

              {/* Transparent Smoked-Acrylic Tape Bay Window */}
              <CassetteWindow
                track={currentTrack}
                deckState={deckState}
                side={side}
                progressPct={progressPct}
                isAutoReversing={isAutoReversing}
                swapCount={swapCount}
              />

              {/* Tactile Auxiliary Deck Controls: Heart Save, Singer Info, QR Share, Volume & SFX */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-[#12151d] px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!currentTrack}
                    onClick={() => {
                      if (!currentTrack) return;
                      playMechanicalClick('key', sfxEnabled);
                      handleToggleFavorite(currentTrack);
                    }}
                    aria-label={
                      isCurrentFav ? 'Remove from Mixtape' : 'Save to Mixtape'
                    }
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition disabled:opacity-40 ${
                      isCurrentFav
                        ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                        : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isCurrentFav ? 'fill-rose-500 text-rose-500' : ''
                      }`}
                    />
                    <span>{isCurrentFav ? 'Saved' : 'Save'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!currentTrack}
                    onClick={() => {
                      if (!currentTrack) return;
                      playMechanicalClick('key', sfxEnabled);
                      setSingerDrawerTrack(currentTrack);
                    }}
                    aria-label="Open Singer Info"
                    className="flex min-h-[40px] items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-40"
                  >
                    <User className="h-4 w-4 text-amber-400" />
                    <span>Singer</span>
                  </button>

                  <button
                    type="button"
                    disabled={!currentTrack}
                    onClick={() => {
                      if (!currentTrack) return;
                      playMechanicalClick('key', sfxEnabled);
                      if (window.innerWidth >= 1024) {
                        setActiveTab('share');
                      } else {
                        setQrModalTrack(currentTrack);
                      }
                    }}
                    aria-label="Open Share Code and QR Card"
                    className="flex min-h-[40px] items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 text-xs font-semibold text-slate-300 transition hover:text-amber-300 disabled:opacity-40"
                  >
                    <QrCode className="h-4 w-4 text-amber-400" />
                    <span>QR</span>
                  </button>
                </div>

                {/* Volume & Mechanical Click SFX Hardware Toggle Switch */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sfxEnabled}
                    onClick={() => {
                      const next = !sfxEnabled;
                      setSfxEnabled(next);
                      if (next) {
                        playMechanicalClick('key', true);
                      }
                    }}
                    title={
                      sfxEnabled
                        ? 'Turn mechanical deck sound effects OFF'
                        : 'Turn mechanical deck sound effects ON'
                    }
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md border px-2.5 font-mono-lcd text-[10px] font-bold tracking-wider transition ${
                      sfxEnabled
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[inset_0_1px_0_rgba(251,191,36,0.2)]'
                        : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sfxEnabled
                          ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span>SFX: {sfxEnabled ? 'ON' : 'OFF'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVolume((v) => (v > 0 ? 0 : 0.85))}
                      aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
                      className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-white"
                    >
                      {volume === 0 ? (
                        <VolumeX className="h-4 w-4 text-rose-400" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-amber-400" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="Headphone volume"
                      className="h-1.5 w-16 cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM MECHANICAL TAPE-RECORDER PIANO KEYS */}
            <div className="mt-3">
              <PianoKeys
                deckState={deckState}
                side={side}
                disabled={!currentTrack}
                onRew={handlePrevTrack}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                onFf={() => handleNextTrack(true)}
                onFlipSide={handleManualFlip}
              />
            </div>

            {/* Bottom Chassis Engraved Footnote */}
            <div className="mt-2.5 flex items-center justify-between px-2 font-mono-lcd text-[10px] tracking-widest text-slate-500">
              <span>DOLBY-STYLE HI-FI · NO ADS</span>
              <span>AUTO-FLIP EVERY 06 TRACKS</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Online Catalog Search, Persistent Mixtape Shelf & Share QR Studio */}
        <section
          aria-label="Music Discovery, Mixtape Shelf and Song Sharing"
          className="flex flex-col gap-4 lg:col-span-7"
        >
          <div className="rounded-2xl border border-slate-800 bg-[#171b24] p-4 shadow-xl sm:p-5">
            {/* Segmented Tab Switcher */}
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-[#10131a] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-1.5 text-[11px] font-bold tracking-normal whitespace-nowrap transition sm:gap-2 sm:px-2 sm:text-xs sm:tracking-wide ${
                  activeTab === 'catalog'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mixtape')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-1.5 text-[11px] font-bold tracking-normal whitespace-nowrap transition sm:gap-2 sm:px-2 sm:text-xs sm:tracking-wide ${
                  activeTab === 'mixtape'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListMusic className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span>Mixtape ({favorites.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('share')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-1.5 text-[11px] font-bold tracking-normal whitespace-nowrap transition sm:gap-2 sm:px-2 sm:text-xs sm:tracking-wide ${
                  activeTab === 'share'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span>Share</span>
              </button>
            </div>

            {/* Active Tab Body */}
            {activeTab === 'catalog' && (
              <SearchCatalog
                currentTrackId={currentTrack?.id}
                favoriteIds={favoriteIds}
                initialTracks={starterTracks}
                tasteMap={tasteMap}
                onRecordTaste={recordTaste}
                sfxEnabled={sfxEnabled}
                onSelectTrack={(track, list) => loadAndPlayTrack(track, list)}
                onToggleFavorite={handleToggleFavorite}
                onSearchStatus={(status, count) => {
                  if (status === 'searching') {
                    flashBanner('SEARCHING...', 15000);
                  } else if (status === 'not_found') {
                    flashBanner('NO SIGNAL / NOT FOUND', 2600);
                  } else {
                    flashBanner(
                      `FOUND ${String(count || 0).padStart(2, '0')} TRACKS`,
                      1400
                    );
                  }
                }}
              />
            )}

            {activeTab === 'mixtape' && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-[#12161f] p-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold tracking-wider uppercase text-slate-100">
                      My Mixtape / Favorites
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {favorites.length} saved · {localTracks.length} local loaded
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={triggerLocalFilePicker}
                    className="brushed-metal inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-400/80 px-3.5 py-2 font-display text-xs font-extrabold tracking-[0.1em] uppercase text-[#171b22] shadow-[0_3px_0_#374151,inset_0_1px_0_rgba(255,255,255,0.85)] transition active:translate-y-[2px] active:shadow-[0_1px_0_#374151]"
                  >
                    <FolderUp className="h-4 w-4 text-amber-700" />
                    <span>LOAD TAPE (.MP3)</span>
                  </button>
                </div>
                <MixtapeShelf
                  favorites={favorites}
                  localTracks={localTracks}
                  currentTrackId={currentTrack?.id}
                  onSelectTrack={(track, list) => loadAndPlayTrack(track, list)}
                  onRemoveFavorite={(id) =>
                    setFavorites((prev) => prev.filter((t) => t.id !== id))
                  }
                  onOpenQr={(track) => setQrModalTrack(track)}
                  onOpenSinger={(track) => setSingerDrawerTrack(track)}
                />
              </div>
            )}

            {activeTab === 'share' && (
              <div>
                {currentTrack ? (
                  <MusicNoteQRCard track={currentTrack} />
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-[#12161f] p-8 text-center text-sm text-slate-400">
                    Load a cassette to generate its unique SSP-... code and scannable Music-Note QR card.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Tape Queue Strip */}
          {queue.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#171b24] p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold tracking-wider uppercase text-slate-300">
                  Active Tape Queue · Auto-Reverses After Track 06
                </h2>
                <span className="font-mono-lcd text-xs text-amber-400">
                  SIDE {side} · {String(sideTrackIndex).padStart(2, '0')}/06
                </span>
              </div>
              <div className="hardware-scroll flex gap-2.5 overflow-x-auto pb-1">
                {queue.slice(0, 12).map((item, idx) => {
                  const isCurrent = item.id === currentTrack?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => loadAndPlayTrack(item)}
                      className={`flex min-w-[165px] max-w-[190px] shrink-0 flex-col rounded-xl border p-2.5 text-left transition ${
                        isCurrent
                          ? 'border-amber-500/70 bg-amber-500/12'
                          : 'border-slate-800 bg-[#12161f] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-lcd text-[10px] text-slate-400">
                        <span>TAPE {String(idx + 1).padStart(2, '0')}</span>
                        {isCurrent && (
                          <span className="font-bold text-amber-400">DECK</span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-100">
                        {item.title}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {item.artist}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Slide-Up Singer / Artist Info Drawer */}
      <SingerInfoDrawer
        track={singerDrawerTrack}
        isOpen={!!singerDrawerTrack}
        onClose={() => setSingerDrawerTrack(null)}
        onSelectTrack={(track) => loadAndPlayTrack(track)}
        currentTrackId={currentTrack?.id}
      />

      {/* Mobile / Shelf Modal for Music-Note QR Share Card */}
      {qrModalTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setQrModalTrack(null)}
        >
          <div
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <MusicNoteQRCard
              track={qrModalTrack}
              onClose={() => setQrModalTrack(null)}
              compact
            />
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
