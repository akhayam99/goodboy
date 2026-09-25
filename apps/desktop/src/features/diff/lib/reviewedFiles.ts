import type { DiffView, FileDiff, SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';

export type ViewedState = 'none' | 'viewed' | 'stale';

export type ReviewedMap = Readonly<Record<string, string>>;

const viewKeyOf = (view: DiffView): string => {
  if (view.kind === 'commit') {
    return `commit:${view.sha}`;
  }
  if (view.kind === 'working') {
    return `working:${view.scope}`;
  }
  return 'branch';
};

export const fileSignature = (file: FileDiff): string =>
  `${file.status}:${file.additions}:${file.deletions}:${file.hunks.length}:${file.hunks
    .map((hunk) => hunk.header)
    .join('§')}`;

const storageKey = (sessionId: SessionId | null, view: DiffView): string | null =>
  sessionId ? `${STORAGE_PREFIXES.diffReviewed}${sessionId}:${viewKeyOf(view)}` : null;

export const readReviewedMap = (sessionId: SessionId | null, view: DiffView): ReviewedMap => {
  const key = storageKey(sessionId, view);
  if (key === null || typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? (parsed as ReviewedMap) : {};
  } catch {
    return {};
  }
};

export const writeReviewedMap = (
  sessionId: SessionId | null,
  view: DiffView,
  map: ReviewedMap,
): void => {
  const key = storageKey(sessionId, view);
  if (key === null || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    return;
  }
};

export const viewedStateOf = (file: FileDiff, map: ReviewedMap): ViewedState => {
  const saved = map[file.path];
  if (!saved) {
    return 'none';
  }
  return saved === fileSignature(file) ? 'viewed' : 'stale';
};
