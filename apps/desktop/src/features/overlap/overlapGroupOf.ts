import { overlapsOf } from './overlapsOf';
import type { LiveMount } from './readLiveMounts';

export type MergeReason =
  'fewest-files' | 'fewer-files' | 'started-earlier' | 'most-files' | 'started-later';

export type MergeStep = Readonly<{
  mount: LiveMount;
  reason: MergeReason;
  isOwn: boolean;
  sharedPaths: ReadonlyArray<string>;
}>;

export type OverlapGroup = Readonly<{
  mount: LiveMount;
  steps: ReadonlyArray<MergeStep>;
  sharedPaths: ReadonlyArray<string>;
}>;

type Params = {
  readonly mounts: ReadonlyArray<LiveMount>;
  readonly mountId: string;
};

type PairParams = {
  readonly left: LiveMount;
  readonly right: LiveMount;
};

type ReasonParams = {
  readonly order: ReadonlyArray<LiveMount>;
  readonly index: number;
};

const mergesBefore = ({ left, right }: PairParams): number => {
  if (left.paths.length !== right.paths.length) {
    return left.paths.length - right.paths.length;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.mountId < right.mountId ? -1 : 1;
};

const reasonOf = ({ order, index }: ReasonParams): MergeReason => {
  const files = order[index]?.paths.length ?? 0;
  const next = order[index + 1];
  if (next !== undefined) {
    if (files === next.paths.length) {
      return 'started-earlier';
    }
    return index === 0 ? 'fewest-files' : 'fewer-files';
  }
  const previous = order[index - 1];
  return previous !== undefined && files > previous.paths.length ? 'most-files' : 'started-later';
};

export const overlapGroupOf = ({ mounts, mountId }: Params): OverlapGroup | null => {
  const overlaps = overlapsOf({ mounts, mountId });
  const [first] = overlaps;
  if (first === undefined) {
    return null;
  }
  const { mount } = first;
  const shared = new Set(overlaps.flatMap((overlap) => overlap.paths));
  const sharedPaths = mount.paths.filter((path) => shared.has(path));
  const pathsWith = new Map(overlaps.map((overlap) => [overlap.other.mountId, overlap.paths]));
  const order = [mount, ...overlaps.map((overlap) => overlap.other)].sort((left, right) =>
    mergesBefore({ left, right }),
  );
  return {
    mount,
    sharedPaths,
    steps: order.map((step, index) => ({
      mount: step,
      reason: reasonOf({ order, index }),
      isOwn: step.mountId === mount.mountId,
      sharedPaths: pathsWith.get(step.mountId) ?? sharedPaths,
    })),
  };
};
