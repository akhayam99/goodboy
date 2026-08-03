import type { ReleaseNote } from '../../../features/changelog/changelog';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

export type ChangelogCache = {
  readonly fetchedAt: string;
  readonly releases: ReadonlyArray<ReleaseNote>;
};

const isReleaseNote = (value: unknown): value is ReleaseNote => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'string' &&
    typeof candidate.publishedAt === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.htmlUrl === 'string'
  );
};

export const readChangelogCache = (): ChangelogCache | null => {
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
    if (typeof candidate.fetchedAt !== 'string' || !Array.isArray(candidate.releases)) {
      return null;
    }
    const releases = candidate.releases.filter(isReleaseNote);
    return { fetchedAt: candidate.fetchedAt, releases };
  } catch {
    return null;
  }
};

export const writeChangelogCache = ({ fetchedAt, releases }: ChangelogCache): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.changelogCache, JSON.stringify({ fetchedAt, releases }));
  } catch {
    return;
  }
};
