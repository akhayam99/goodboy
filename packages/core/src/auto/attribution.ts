import type { ResultChangedFile } from './result';

export const ATTRIBUTION_CLEAN = 'clean';
export const ATTRIBUTION_LIST_CAP = 50;

export type SnapshotEntry = Readonly<{
  path: string;
  hash: string;
}>;

export type MountSnapshot = Readonly<{
  head: string;
  entries: ReadonlyArray<SnapshotEntry>;
  isPartial: boolean;
}>;

export type AttributeChangesParams = Readonly<{
  baseline: MountSnapshot | null;
  result: MountSnapshot | null;
  isWriter: boolean;
}>;

export type AttributedChanges = Readonly<{
  changedFiles: ReadonlyArray<ResultChangedFile>;
  hasReadOnlyViolation: boolean;
  isComplete: boolean;
}>;

type HashMapParams = {
  readonly snapshot: MountSnapshot;
};

const hashMapOf = ({ snapshot }: HashMapParams): ReadonlyMap<string, string> =>
  new Map(snapshot.entries.map((entry) => [entry.path, entry.hash]));

export const attributeChanges = ({
  baseline,
  result,
  isWriter,
}: AttributeChangesParams): AttributedChanges => {
  if (baseline === null || result === null) {
    return { changedFiles: [], hasReadOnlyViolation: false, isComplete: false };
  }
  const before = hashMapOf({ snapshot: baseline });
  const after = hashMapOf({ snapshot: result });
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changed: ResultChangedFile[] = [];
  const preexisting: ResultChangedFile[] = [];
  for (const path of paths) {
    const was = before.get(path) ?? ATTRIBUTION_CLEAN;
    const now = after.get(path) ?? ATTRIBUTION_CLEAN;
    if (was !== now) {
      changed.push({ path, ownership: isWriter ? 'attempt' : 'unattributed' });
      continue;
    }
    if (was !== ATTRIBUTION_CLEAN) {
      preexisting.push({ path, ownership: 'preexisting' });
    }
  }
  return {
    changedFiles: [
      ...changed.slice(0, ATTRIBUTION_LIST_CAP),
      ...preexisting.slice(0, ATTRIBUTION_LIST_CAP),
    ],
    hasReadOnlyViolation: !isWriter && changed.length > 0,
    isComplete: !baseline.isPartial && !result.isPartial,
  };
};
