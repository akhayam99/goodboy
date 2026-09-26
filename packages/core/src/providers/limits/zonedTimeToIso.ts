import type { IsoDateTime } from '@goodboy/types';

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

type FormatPartsParams = {
  readonly instantMs: number;
  readonly timeZone: string;
};

const zonedParts = ({ instantMs, timeZone }: FormatPartsParams): Record<string, string> | null => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts: Record<string, string> = {};
    for (const part of formatter.formatToParts(new Date(instantMs))) {
      parts[part.type] = part.value;
    }
    return parts;
  } catch {
    return null;
  }
};

type WallClockMsParams = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
};

const wallClockMs = ({ year, month, day, hour, minute }: WallClockMsParams): number =>
  Date.UTC(year, month - 1, day, hour, minute, 0);

type ZonedTodayParams = {
  readonly nowMs: number;
  readonly timeZone: string;
};

export const zonedToday = ({
  nowMs,
  timeZone,
}: ZonedTodayParams): { year: number; month: number; day: number } | null => {
  const parts = zonedParts({ instantMs: nowMs, timeZone });
  if (parts === null) {
    return null;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
};

export const monthNumberOf = ({ name }: { readonly name: string }): number | null =>
  MONTHS[name.slice(0, 3).toLowerCase()] ?? null;

type ZonedTimeToIsoParams = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly timeZone: string;
  readonly nowMs: number;
};

export const zonedTimeToIso = ({
  year,
  month,
  day,
  hour,
  minute,
  timeZone,
  nowMs,
}: ZonedTimeToIsoParams): IsoDateTime | null => {
  const guessMs = wallClockMs({ year, month, day, hour, minute });
  const parts = zonedParts({ instantMs: guessMs, timeZone });
  if (parts === null) {
    return null;
  }
  const asIfUtcMs = wallClockMs({
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
  });
  if (!Number.isFinite(asIfUtcMs)) {
    return null;
  }
  const offsetMs = asIfUtcMs - guessMs;
  const resolvedMs = guessMs - offsetMs;
  if (resolvedMs < nowMs - 24 * 60 * 60 * 1000) {
    return new Date(resolvedMs + 365 * 24 * 60 * 60 * 1000).toISOString() as IsoDateTime;
  }
  return new Date(resolvedMs).toISOString() as IsoDateTime;
};
