export interface TasteEntry {
  label: string;
  count: number;
  updatedAt: number;
}

export type TasteMap = Record<string, TasteEntry>;

export const TASTE_STORAGE_KEY = 'ss_playman_taste_v1';

export const DISCOVERY_POOL = [
  'Ilaiyaraaja',
  'SPB',
  'AR Rahman',
  'Sid Sriram',
  'Anirudh',
  'Arijit Singh',
  'Shreya Ghoshal',
  'Synthwave',
  '80s Retro',
  'Lo-Fi Tape',
  'Daft Punk',
] as const;

const IGNORED_NAMES = new Set([
  'unknown artist',
  'local cassette',
  'independent artist',
  'internet archive artist',
  'various artists',
]);

export function normalizeTasteKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanSingerLabel(rawName: string): string | null {
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // Extract lead singer when metadata lists multiple collaborators separated by commas/feat
  let lead = trimmed.split(/\s*(?:,|feat\.?|ft\.?|\/)\s*/i)[0]?.trim() || trimmed;
  if (lead.length > 24 && lead.includes('&')) {
    lead = lead.split('&')[0]?.trim() || lead;
  }

  // Match canonical casing from DISCOVERY_POOL if equivalent
  const norm = normalizeTasteKey(lead);
  if (!norm || IGNORED_NAMES.has(norm)) return null;

  const canonical = DISCOVERY_POOL.find((p) => normalizeTasteKey(p) === norm);
  return canonical || lead;
}

export function loadTasteMap(): TasteMap {
  try {
    const raw = localStorage.getItem(TASTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: TasteMap = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        val &&
        typeof val === 'object' &&
        typeof (val as TasteEntry).label === 'string' &&
        typeof (val as TasteEntry).count === 'number' &&
        (val as TasteEntry).count > 0
      ) {
        clean[key] = {
          label: (val as TasteEntry).label,
          count: (val as TasteEntry).count,
          updatedAt:
            typeof (val as TasteEntry).updatedAt === 'number'
              ? (val as TasteEntry).updatedAt
              : Date.now(),
        };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveTasteMap(map: TasteMap): void {
  try {
    localStorage.setItem(TASTE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota ignored
  }
}

export function recordSingerTaste(
  currentMap: TasteMap,
  rawName: string,
  weight = 1
): TasteMap {
  const label = cleanSingerLabel(rawName);
  if (!label) return currentMap;

  const key = normalizeTasteKey(label);
  const existing = currentMap[key];
  const nextMap: TasteMap = {
    ...currentMap,
    [key]: {
      label: existing?.label || label,
      count: (existing?.count || 0) + weight,
      updatedAt: Date.now(),
    },
  };
  saveTasteMap(nextMap);
  return nextMap;
}

export function getTopPersonalChips(map: TasteMap, limit = 3): string[] {
  return Object.values(map)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit)
    .map((entry) => entry.label);
}

export function pickDiscoveryChips(
  excludeLabels: string[],
  neededCount: number,
  previousBatch: string[] = []
): string[] {
  if (neededCount <= 0) return [];
  const excludedKeys = new Set(excludeLabels.map(normalizeTasteKey));
  const prevKeys = new Set(previousBatch.map(normalizeTasteKey));

  const available = DISCOVERY_POOL.filter(
    (item) => !excludedKeys.has(normalizeTasteKey(item))
  );

  // Prefer items not in the previous discovery batch first for fresh shuffles
  const fresh = available.filter((item) => !prevKeys.has(normalizeTasteKey(item)));
  const recycled = available.filter((item) => prevKeys.has(normalizeTasteKey(item)));

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return [...shuffleArray(fresh), ...shuffleArray(recycled)].slice(0, neededCount);
}
