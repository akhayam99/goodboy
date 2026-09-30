import { STORAGE_KEYS, persistedPref } from '../../../shared/lib/storage-keys';

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

const cachePref = persistedPref<ChangelogDatesCache | null>({
  key: STORAGE_KEYS.changelogCache,
  fallback: null,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.fetchedAt !== 'string' || !isDatesRecord(candidate.dates)) {
      return undefined;
    }
    return { fetchedAt: candidate.fetchedAt, dates: candidate.dates };
  },
});

export const readChangelogDatesCache = cachePref.read;

export const writeChangelogDatesCache = ({ fetchedAt, dates }: ChangelogDatesCache): void =>
  cachePref.write({ fetchedAt, dates });
