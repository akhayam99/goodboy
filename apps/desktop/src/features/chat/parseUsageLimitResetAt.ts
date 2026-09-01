type Params = {
  readonly message: string;
  readonly nowMs?: number;
};

const RESET_PATTERNS = [
  /try again at\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i,
  /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i,
];

const matchResetTime = ({ message }: { readonly message: string }): RegExpExecArray | null => {
  for (const pattern of RESET_PATTERNS) {
    const match = pattern.exec(message);
    if (match !== null) {
      return match;
    }
  }
  return null;
};

export const parseUsageLimitResetAt = ({ message, nowMs }: Params): number | null => {
  const match = matchResetTime({ message });
  if (match === null) {
    return null;
  }
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute > 59) {
    return null;
  }
  const meridiem = match[3]?.toLowerCase() ?? null;
  if (meridiem !== null && (rawHour < 1 || rawHour > 12)) {
    return null;
  }
  const hour = meridiem === null ? rawHour : (rawHour % 12) + (meridiem === 'pm' ? 12 : 0);
  if (hour > 23) {
    return null;
  }
  const base = nowMs ?? Date.now();
  const candidate = new Date(base);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= base) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
};
