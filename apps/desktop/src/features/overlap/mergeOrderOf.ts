import type { Overlap } from './overlapsOf';
import type { LiveMount } from './readLiveMounts';

export type MergeOrder = Readonly<{
  first: LiveMount;
  then: LiveMount;
  firstFiles: number;
  thenFiles: number;
  reason: 'fewer-files' | 'older';
}>;

type Params = {
  readonly overlap: Overlap;
};

type PairParams = {
  readonly first: LiveMount;
  readonly then: LiveMount;
  readonly reason: MergeOrder['reason'];
};

const orderOf = ({ first, then, reason }: PairParams): MergeOrder => ({
  first,
  then,
  firstFiles: first.paths.length,
  thenFiles: then.paths.length,
  reason,
});

const isOlder = ({ first, then }: Omit<PairParams, 'reason'>): boolean =>
  first.createdAt < then.createdAt ||
  (first.createdAt === then.createdAt && first.mountId < then.mountId);

export const mergeOrderOf = ({ overlap }: Params): MergeOrder => {
  const { mount, other } = overlap;
  if (mount.paths.length !== other.paths.length) {
    return mount.paths.length < other.paths.length
      ? orderOf({ first: mount, then: other, reason: 'fewer-files' })
      : orderOf({ first: other, then: mount, reason: 'fewer-files' });
  }
  return isOlder({ first: mount, then: other })
    ? orderOf({ first: mount, then: other, reason: 'older' })
    : orderOf({ first: other, then: mount, reason: 'older' });
};
