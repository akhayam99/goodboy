import { applyFixesLabel } from './commentProjection';
import {
  commitCountText,
  fixingCountText,
  threadCountText,
  type FixingCount,
} from './reviewLaunchCopy';

type HeaderPrimaryKind = 'fixing' | 'apply' | 'fix' | 'push' | 'request_review';

export type HeaderPrimary = {
  readonly kind: HeaderPrimaryKind;
  readonly label: string;
  readonly isDisabled: boolean;
};

type Params = {
  readonly fixing: FixingCount | null;
  readonly waitingFixes: number;
  readonly fixableThreads: number;
  readonly unpushedCommits: number;
  readonly hasOpenThreads: boolean;
};

export const headerPrimaryOf = ({
  fixing,
  waitingFixes,
  fixableThreads,
  unpushedCommits,
  hasOpenThreads,
}: Params): HeaderPrimary | null => {
  if (fixing !== null && fixing.working > 0) {
    return {
      kind: 'fixing',
      label: fixingCountText(fixing),
      isDisabled: true,
    };
  }
  if (waitingFixes > 0) {
    return { kind: 'apply', label: applyFixesLabel({ count: waitingFixes }), isDisabled: false };
  }
  if (fixableThreads > 0) {
    return {
      kind: 'fix',
      label: `Fix ${threadCountText({ count: fixableThreads })}`,
      isDisabled: false,
    };
  }
  if (unpushedCommits > 0) {
    return {
      kind: 'push',
      label: `Push ${commitCountText({ count: unpushedCommits })}`,
      isDisabled: false,
    };
  }
  if (hasOpenThreads) {
    return null;
  }
  return { kind: 'request_review', label: 'Request review', isDisabled: false };
};
