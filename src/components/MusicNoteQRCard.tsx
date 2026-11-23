import React, { useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Music2, Share2, X } from 'lucide-react';
import type { Track } from '../types/music';
import { buildShareUrl, encodeSongCode } from '../utils/songCode';

interface MusicNoteQRCardProps {
  track: Track;
  onClose?: () => void;
  compact?: boolean;
}

function isFinderZone(row: number, col: number, size: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= size - 7) return true;
  if (row >= size - 7 && col < 7) return true;
  return false;
}

export const MusicNoteQRCard: React.FC<MusicNoteQRCardProps> = ({
  track,
  onClose,
  compact = false,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const songCode = useMemo(() => encodeSongCode(track), [track]);
  const shareUrl = useMemo(() => buildShareUrl(track), [track]);

  const qrMatrix = useMemo(() => {
    const qr = QRCode.create(shareUrl, { errorCorrectionLevel: 'H' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    return { size, data };
  }, [shareUrl]);

  const quiet = 4;
  const totalView = qrMatrix.size + quiet * 2;
  const centerIdx = qrMatrix.size / 2;
  const emblemClearRadius = qrMatrix.size * 0.14;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(songCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadCard = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 880;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw cassette share card background
    ctx.fillStyle = '#181c24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cream retro cassette paper label
    ctx.fillStyle = '#faf6ea';
    ctx.beginPath();
    ctx.roundRect(40, 40, 640, 800, 24);
    ctx.fill();

    // Amber header band
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(40, 40, 640, 88);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('♪  SS PLAYMAN  ♫', 72, 98);

    // QR SVG image
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 140, 168, 440, 440);
      URL.revokeObjectURL(url);

      ctx.fillStyle = '#181c24';
      ctx.font = 'bold 30px sans-serif';
      const titleText =
        track.title.length > 34 ? `${track.title.slice(0, 31)}...` : track.title;
      ctx.fillText(titleText, 72, 668);

      ctx.fillStyle = '#475569';
      ctx.font = '600 22px sans-serif';
      ctx.fillText(track.artist.slice(0, 40), 72, 706);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 16px monospace';
      const codeSnippet =
        songCode.length > 46 ? `${songCode.slice(0, 43)}...` : songCode;
      ctx.fillText(codeSnippet, 72, 760);

      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('SCAN QR OR PASTE SSP CODE IN SS PLAYMAN', 72, 804);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ss-playman-${track.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 24)}.png`;
      link.href = pngUrl;
      link.click();
    };
    img.src = url;
  };

  const handleShareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${track.title} — ${track.artist} | SS Playman`,
          text: `Listen to "${track.title}" by ${track.artist} on SS Playman. Code: ${songCode}`,
          url: shareUrl,
        });
        setSharedStatus('Shared');
        setTimeout(() => setSharedStatus(null), 1800);
        return;
      } catch {
        // User cancelled or share failed, fall back to copy
      }
    }
    await handleCopyLink();
  };

  const modules: React.ReactNode[] = [];
  for (let r = 0; r < qrMatrix.size; r++) {
    for (let c = 0; c < qrMatrix.size; c++) {
      const idx = r * qrMatrix.size + c;
      if (!qrMatrix.data[idx]) continue;
      if (isFinderZone(r, c, qrMatrix.size)) continue;

      const dist = Math.hypot(c + 0.5 - centerIdx, r + 0.5 - centerIdx);
      if (dist < emblemClearRadius) continue;

      modules.push(
        <rect
          key={`${r}-${c}`}
          x={quiet + c + 0.08}
          y={quiet + r + 0.08}
          width={0.84}
          height={0.84}
          rx={0.28}
          fill="#141821"
        />
      );
    }
  }

  const finderPositions = [
    { x: quiet, y: quiet },
    { x: quiet + qrMatrix.size - 7, y: quiet },
    { x: quiet, y: quiet + qrMatrix.size - 7 },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#faf6ea] text-[#171b24] shadow-2xl">
      {/* Cassette Label Top Accent Band */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#d97706] px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none" aria-hidden="true">♪</span>
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.14em]">
            SS PLAYMAN · SHARE CASSETTE
          </span>
          <span className="text-base leading-none" aria-hidden="true">♫</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share card"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-black/20 text-white transition hover:bg-black/35"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Retro Cassette Label Metadata */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-300 pb-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-extrabold uppercase tracking-wide text-[#141821]">
              {track.title}
            </div>
            <div className="truncate text-xs font-semibold text-slate-600">
              {track.artist}
              {track.genre ? ` · ${track.genre}` : ''}
            </div>
          </div>
          <span className="font-mono-lcd shrink-0 rounded bg-[#141821] px-2 py-1 text-[10px] font-bold tracking-wider text-amber-300">
            CrO2
          </span>
        </div>

        {/* Scannable Music-Note Styled QR Code */}
        <div className="relative mx-auto my-4 flex w-full max-w-[240px] flex-col items-center rounded-xl border-2 border-slate-300 bg-[#fcfaf2] p-3 shadow-inner">
          {/* Corner decorative music notes safely outside QR quiet zone */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-2 text-xs font-bold text-amber-600/80"
          >
            ♪
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 right-2 text-xs font-bold text-amber-600/80"
          >
            ♫
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 right-2 text-xs font-bold text-amber-600/80"
          >
            ♪
          </span>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${totalView} ${totalView}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Scannable QR code for ${track.title} by ${track.artist}`}
          >
            <rect width={totalView} height={totalView} fill="#fcfaf2" rx="2" />

            {/* Rounded-dot data modules */}
            {modules}

            {/* Styled retro cassette-hub finder patterns */}
            {finderPositions.map((pos, i) => (
              <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect
                  x={0}
                  y={0}
                  width={7}
                  height={7}
                  rx={1.5}
                  fill="#141821"
                />
                <rect
                  x={1}
                  y={1}
                  width={5}
                  height={5}
                  rx={0.9}
                  fill="#fcfaf2"
                />
                <rect
                  x={2}
                  y={2}
                  width={3}
                  height={3}
                  rx={0.8}
                  fill={i === 0 ? '#ea580c' : '#141821'}
                />
              </g>
            ))}

            {/* High-Contrast Center Music Note Emblem (within Error Correction H tolerance) */}
            <circle
              cx={quiet + centerIdx}
              cy={quiet + centerIdx}
              r={emblemClearRadius - 0.3}
              fill="#fcfaf2"
              stroke="#ea580c"
              strokeWidth={0.5}
            />
            <text
              x={quiet + centerIdx}
              y={quiet + centerIdx + 1.45}
              textAnchor="middle"
              fontSize={emblemClearRadius * 1.15}
              fontWeight="bold"
              fill="#141821"
            >
              ♫
            </text>
          </svg>
        </div>

        {/* Shareable SSP Code Box */}
        <div className="rounded-lg border border-slate-300 bg-[#efeadc] px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Song Tape Code</span>
            <Music2 className="h-3 w-3 text-amber-700" />
          </div>
          <div className="font-mono-lcd mt-1 truncate text-xs font-semibold text-[#141821] select-all">
            {songCode}
          </div>
          {track.source === 'local' && (
            <p className="mt-1 text-[11px] leading-snug text-amber-900/80">
              Local device file: recipients match title &amp; singer from online catalogs when scanned.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-[#171b24] transition hover:bg-slate-100"
          >
            {copiedCode ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareCard}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#171b24] px-2.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-slate-800"
          >
            {copiedLink || sharedStatus ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>{sharedStatus || 'Copied'}</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCard}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-500/15 px-2.5 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-500/25"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
