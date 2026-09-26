import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

export type ChangelogDatesCache = {
  readonly fetchedAt: string;
  readonly dates: Readonly<Record<string, string>>;
};

const isDatesRecord = (value: unknown): value is Record<string, string> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
};

export const readChangelogDatesCache = (): ChangelogDatesCache | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEYS.changelogCache);
  if (raw == null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.fetchedAt !== 'string' || !isDatesRecord(candidate.dates)) {
      return null;
    }
    return { fetchedAt: candidate.fetchedAt, dates: candidate.dates };
  } catch {
    return null;
  }
};

export const writeChangelogDatesCache = ({ fetchedAt, dates }: ChangelogDatesCache): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.changelogCache, JSON.stringify({ fetchedAt, dates }));
  } catch {
    return;
  }
};
