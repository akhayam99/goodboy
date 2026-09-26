import type { IsoDateTime, ProviderLimitWindow, ProviderLimits } from '@goodboy/types';
import { providerLimitsStatus, windowStatus } from './providerLimitsStatus';
import { monthNumberOf, zonedTimeToIso, zonedToday } from './zonedTimeToIso';

const LINE_RE =
  /^Current (session|week)(?:\s*\(([^)]+)\))?:\s*(\d+)%\s*used\s*[·-]\s*resets\s+(.+)$/i;

const RESET_RE =
  /^(?:([A-Za-z]{3,9})\s+(\d{1,2})\s+at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)\s*$/i;

type ResetTextParams = {
  readonly text: string;
  readonly nowMs: number;
};

type CalendarDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

type ExplicitDateParams = {
  readonly monthName: string;
  readonly dayText: string;
  readonly nowMs: number;
  readonly timeZone: string;
};

const explicitDate = ({
  monthName,
  dayText,
  nowMs,
  timeZone,
}: ExplicitDateParams): CalendarDate | null => {
  const month = monthNumberOf({ name: monthName });
  if (month === null) {
    return null;
  }
  const today = zonedToday({ nowMs, timeZone });
  const year = today?.year ?? new Date(nowMs).getUTCFullYear();
  return { year, month, day: Number(dayText) };
};

type TodayDateParams = {
  readonly nowMs: number;
  readonly timeZone: string;
};

const todayDate = ({ nowMs, timeZone }: TodayDateParams): CalendarDate | null =>
  zonedToday({ nowMs, timeZone });

const resetsAtOf = ({ text, nowMs }: ResetTextParams): IsoDateTime | null => {
  const match = RESET_RE.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, monthName, dayText, hourText, minuteText, meridiem, timeZoneMatch] = match;
  const hour12 = Number(hourText);
  if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12) {
    return null;
  }
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const isPm = meridiem?.toLowerCase() === 'pm';
  const hour = (hour12 % 12) + (isPm ? 12 : 0);
  const timeZone = timeZoneMatch ?? 'UTC';

  const date =
    monthName !== undefined && dayText !== undefined
      ? explicitDate({ monthName, dayText, nowMs, timeZone })
      : todayDate({ nowMs, timeZone });
  if (date === null) {
    return null;
  }
  if (!Number.isFinite(date.day) || date.day < 1 || date.day > 31) {
    return null;
  }
  return zonedTimeToIso({ ...date, hour, minute, timeZone, nowMs });
};

type LineParams = {
  readonly line: string;
  readonly nowMs: number;
};

const windowOf = ({ line, nowMs }: LineParams): ProviderLimitWindow | null => {
  const match = LINE_RE.exec(line.trim());
  if (match === null) {
    return null;
  }
  const [, span, scope, percentText, resetText] = match;
  const percent = Number(percentText);
  if (!Number.isFinite(percent)) {
    return null;
  }
  const normalizedScope = scope?.trim().toLowerCase() ?? null;
  const kind =
    span?.toLowerCase() === 'session'
      ? 'fiveHour'
      : normalizedScope === null || normalizedScope === 'all models'
        ? 'weekly'
        : 'weeklyModel';
  const model = kind === 'weeklyModel' ? (scope?.trim() ?? null) : null;
  const draft: ProviderLimitWindow = {
    kind,
    model,
    status: 'ok',
    usedFraction: Math.min(Math.max(percent / 100, 0), 1),
    resetsAt: resetText === undefined ? null : resetsAtOf({ text: resetText, nowMs }),
  };
  return { ...draft, status: windowStatus({ window: draft }) };
};

type Params = {
  readonly text: string;
  readonly observedAt: IsoDateTime;
  readonly nowMs: number;
};

export const parseClaudeUsageText = ({
  text,
  observedAt,
  nowMs,
}: Params): ProviderLimits | null => {
  const windows = text
    .split('\n')
    .map((line) => windowOf({ line, nowMs }))
    .filter((window): window is ProviderLimitWindow => window !== null);
  if (windows.length === 0) {
    return null;
  }
  return {
    providerId: 'anthropic',
    plan: null,
    status: providerLimitsStatus({ windows }),
    windows,
    observedAt,
  };
};

type EnvelopeParams = {
  readonly raw: string;
};

export const claudeUsageResultTextOf = ({ raw }: EnvelopeParams): string | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const result: unknown = Reflect.get(parsed, 'result');
  return typeof result === 'string' ? result : null;
};

type ProbeOutputParams = {
  readonly raw: string;
  readonly observedAt: IsoDateTime;
  readonly nowMs: number;
};

export const parseClaudeUsageProbeOutput = ({
  raw,
  observedAt,
  nowMs,
}: ProbeOutputParams): ProviderLimits | null => {
  const resultText = claudeUsageResultTextOf({ raw });
  if (resultText === null) {
    return null;
  }
  return parseClaudeUsageText({ text: resultText, observedAt, nowMs });
};
