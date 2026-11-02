import { applyFixesLabel } from './commentProjection';
import { commitCountText, threadCountText } from './reviewLaunchCopy';

type HeaderPrimaryKind = 'fixing' | 'apply' | 'fix' | 'push' | 'request_review';

export type HeaderPrimary = {
  readonly kind: HeaderPrimaryKind;
  readonly label: string;
  readonly isDisabled: boolean;
};

type Params = {
  readonly fixingThreads: number;
  readonly waitingFixes: number;
  readonly fixableThreads: number;
  readonly unpushedCommits: number;
  readonly hasOpenThreads: boolean;
};

export const headerPrimaryOf = ({
  fixingThreads,
  waitingFixes,
  fixableThreads,
  unpushedCommits,
  hasOpenThreads,
}: Params): HeaderPrimary | null => {
  if (fixingThreads > 0) {
    return {
      kind: 'fixing',
      label: `Fixing ${threadCountText({ count: fixingThreads })}`,
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
