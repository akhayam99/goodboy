import type { DiffView, FileDiff, MountId, SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../../shared/lib/storage-keys';

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

const legacyKey = (sessionId: SessionId | null, view: DiffView): string | null =>
  sessionId ? `${STORAGE_PREFIXES.diffReviewed}${sessionId}:${viewKeyOf(view)}` : null;

const storageKey = (
  sessionId: SessionId | null,
  view: DiffView,
  mountId: MountId | null,
): string | null =>
  sessionId && mountId
    ? `${STORAGE_PREFIXES.diffReviewed}${sessionId}:${mountId}:${viewKeyOf(view)}`
    : legacyKey(sessionId, view);

const NOTHING_REVIEWED: ReviewedMap = {};

const reviewedPref = ({ key }: { readonly key: string }) =>
  persistedPref<ReviewedMap>({
    key,
    fallback: NOTHING_REVIEWED,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return parsed !== null && typeof parsed === 'object' ? (parsed as ReviewedMap) : undefined;
    },
  });

export const readReviewedMap = (
  sessionId: SessionId | null,
  view: DiffView,
  mountId: MountId | null = null,
): ReviewedMap => {
  const key = storageKey(sessionId, view, mountId);
  if (key === null) {
    return NOTHING_REVIEWED;
  }
  const saved = reviewedPref({ key }).read();
  const legacy = legacyKey(sessionId, view);
  return saved === NOTHING_REVIEWED && legacy !== null && legacy !== key
    ? reviewedPref({ key: legacy }).read()
    : saved;
};

export const writeReviewedMap = (
  sessionId: SessionId | null,
  view: DiffView,
  map: ReviewedMap,
  mountId: MountId | null = null,
): void => {
  const key = storageKey(sessionId, view, mountId);
  if (key === null) {
    return;
  }
  reviewedPref({ key }).write(map);
};

export const viewedStateOf = (file: FileDiff, map: ReviewedMap): ViewedState => {
  const saved = map[file.path];
  if (!saved) {
    return 'none';
  }
  return saved === fileSignature(file) ? 'viewed' : 'stale';
};
