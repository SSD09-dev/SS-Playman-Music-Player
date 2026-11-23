import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold tracking-wide text-amber-300 transition hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700/80 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 text-amber-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#1a1e27] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold tracking-wide text-white">
                  Install SS Playman
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                1. Tap the <strong className="text-amber-300">Share</strong> button in your Safari toolbar.
                <br />
                2. Scroll down and select <strong className="text-amber-300">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#1a1e27]/95 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Offline Mode — Cached app shell active</span>
    </div>
  );
};
