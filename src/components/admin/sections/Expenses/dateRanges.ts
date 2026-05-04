/**
 * Date-range preset helpers used by the Reports & Analytics page.
 * Returns ISO date strings ("YYYY-MM-DD") for the public API.
 */

export type RangePresetId =
  | 'thisMonth'
  | 'lastMonth'
  | 'last30'
  | 'last90'
  | 'thisQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'allTime'
  | 'custom';

export interface DateRange {
  from: string; // ISO date (inclusive); '' for unbounded
  to: string; // ISO date (inclusive); '' for unbounded
}

export interface RangePreset {
  id: RangePresetId;
  label: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'last90', label: 'Last 90 days' },
  { id: 'thisQuarter', label: 'This quarter' },
  { id: 'thisYear', label: 'Year to date' },
  { id: 'lastYear', label: 'Last year' },
  { id: 'allTime', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

function toIso(d: Date): string {
  // Format as YYYY-MM-DD in *local* time so picker values match what the user sees.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rangeForPreset(id: RangePresetId, today: Date = new Date()): DateRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (id) {
    case 'thisMonth': {
      const from = new Date(t.getFullYear(), t.getMonth(), 1);
      return { from: toIso(from), to: toIso(t) };
    }
    case 'lastMonth': {
      const from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const to = new Date(t.getFullYear(), t.getMonth(), 0);
      return { from: toIso(from), to: toIso(to) };
    }
    case 'last30': {
      const from = new Date(t);
      from.setDate(from.getDate() - 29);
      return { from: toIso(from), to: toIso(t) };
    }
    case 'last90': {
      const from = new Date(t);
      from.setDate(from.getDate() - 89);
      return { from: toIso(from), to: toIso(t) };
    }
    case 'thisQuarter': {
      const q = Math.floor(t.getMonth() / 3);
      const from = new Date(t.getFullYear(), q * 3, 1);
      return { from: toIso(from), to: toIso(t) };
    }
    case 'thisYear': {
      const from = new Date(t.getFullYear(), 0, 1);
      return { from: toIso(from), to: toIso(t) };
    }
    case 'lastYear': {
      const from = new Date(t.getFullYear() - 1, 0, 1);
      const to = new Date(t.getFullYear() - 1, 11, 31);
      return { from: toIso(from), to: toIso(to) };
    }
    case 'allTime':
      return { from: '', to: '' };
    case 'custom':
    default:
      return { from: '', to: '' };
  }
}

/** Best-effort: which preset (if any) does this range correspond to? */
export function detectPreset(range: DateRange, today: Date = new Date()): RangePresetId {
  if (!range.from && !range.to) return 'allTime';
  const candidates: RangePresetId[] = [
    'thisMonth',
    'lastMonth',
    'last30',
    'last90',
    'thisQuarter',
    'thisYear',
    'lastYear',
  ];
  for (const id of candidates) {
    const r = rangeForPreset(id, today);
    if (r.from === range.from && r.to === range.to) return id;
  }
  return 'custom';
}
