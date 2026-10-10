import type { MountId, SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../../../shared/lib/storage-keys';

export type Folds = {
  readonly closed: ReadonlyArray<string>;
  readonly opened: ReadonlyArray<string>;
};

export const MAX_FOLD_ENTRIES = 500;

export const NO_FOLDS: Folds = { closed: [], opened: [] };

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

type KeyParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

type ReadParams = {
  readonly key: string;
};

type WriteParams = ReadParams & {
  readonly folds: Folds;
};

type IsFoldedParams = {
  readonly folds: Folds;
  readonly defaults: ReadonlySet<string>;
  readonly id: string;
};

type WithFoldParams = {
  readonly folds: Folds;
  readonly id: string;
  readonly shouldClose: boolean;
  readonly isDefault: boolean;
};

type PrunedParams = {
  readonly folds: Folds;
  readonly validIds: ReadonlySet<string>;
};

export const foldKeyOf = ({ sessionId, mountId }: KeyParams): string =>
  `${STORAGE_PREFIXES.diffFolds}${sessionId}:${mountId ?? 'none'}`;

const foldsPref = ({ key }: ReadParams) =>
  persistedPref<Folds>({
    key,
    fallback: NO_FOLDS,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return undefined;
      }
      const { closed, opened } = parsed as Record<string, unknown>;
      if (!isStringArray(closed) || !isStringArray(opened)) {
        return undefined;
      }
      return { closed, opened };
    },
  });

export const readFolds = ({ key }: ReadParams): Folds => foldsPref({ key }).read();

export const writeFolds = ({ key, folds }: WriteParams): void => foldsPref({ key }).write(folds);

export const isFoldedIn = ({ folds, defaults, id }: IsFoldedParams): boolean => {
  if (folds.opened.includes(id)) {
    return false;
  }
  return defaults.has(id) || folds.closed.includes(id);
};

export const withFold = ({ folds, id, shouldClose, isDefault }: WithFoldParams): Folds => {
  const closed = folds.closed.filter((entry) => entry !== id);
  const opened = folds.opened.filter((entry) => entry !== id);
  if (shouldClose && !isDefault) {
    closed.push(id);
  }
  if (!shouldClose && isDefault) {
    opened.push(id);
  }
  return { closed, opened };
};

export const prunedFolds = ({ folds, validIds }: PrunedParams): Folds => {
  const closed = folds.closed.filter((id) => validIds.has(id)).slice(-MAX_FOLD_ENTRIES);
  const opened = folds.opened
    .filter((id) => validIds.has(id))
    .slice(-(MAX_FOLD_ENTRIES - closed.length));
  return { closed, opened };
};
