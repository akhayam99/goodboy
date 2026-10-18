import type { SessionId } from '@goodboy/types';
import type { BranchScanEntry } from '../../../store/slices/branch-cleanup';
import { classifyBranch, type ClassifiedBranch } from './classifyBranch';

type Params = {
  readonly scan: BranchScanEntry | undefined;
  readonly now: number;
};

export const classifyBranchScan = ({ scan, now }: Params): ReadonlyArray<ClassifiedBranch> => {
  if (scan?.status !== 'ready') {
    return [];
  }
  const goodboySessions = new Map<string, SessionId | null>(
    scan.goodboy.map((entry) => [entry.branch, entry.sessionId]),
  );
  return scan.scan.branches.map((branch) =>
    classifyBranch({ branch, goodboySessions, userEmail: scan.scan.userEmail, now }),
  );
};
