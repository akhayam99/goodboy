import type { Tone } from '@goodboy/ui';
import type { BranchRowFacts } from '../../../../features/branch/branchRowFactsOf';
import type { RebaseAllBranch } from '../../../../store/slices/rebaseAll/types';

type BranchRowChipKind =
  | 'not-pushed'
  | 'failing'
  | 'conflict'
  | 'behind'
  | 'queued'
  | 'rebasing'
  | 'failed'
  | 'autoResolving'
  | 'rebasedByAuto';

type BranchRowChipIcon = 'git' | 'auto';

export type BranchRowChip = {
  readonly kind: BranchRowChipKind;
  readonly tone: Tone;
  readonly text: string;
  readonly reason: string | null;
  readonly isBreathing: boolean;
  readonly icon: BranchRowChipIcon | null;
};

type Params = {
  readonly signal: BranchRowFacts['signal'];
  readonly rebase: RebaseAllBranch | null;
  readonly isSettled: boolean;
  readonly isRebaseStopped: boolean;
  readonly isBatchSettled: boolean;
  readonly progress: string | null;
  readonly conflictFiles: ReadonlyArray<string>;
};

const COULDNT_REBASE = "Couldn't rebase";

type RebaseParams = Omit<Params, 'signal' | 'rebase'> & {
  readonly rebase: RebaseAllBranch;
};

type RebaseChip = BranchRowChip | null | undefined;

type FilesParams = {
  readonly files: ReadonlyArray<string>;
};

const autoReasonOf = ({ files }: FilesParams): string => {
  const [only] = files;
  if (files.length === 1 && only !== undefined) {
    return `Auto resolves 1 file: ${only}`;
  }
  if (files.length > 1) {
    return `Auto resolves ${files.length} files`;
  }
  return 'Auto resolves it';
};

const autoChipOf = ({
  isSettled,
  isRebaseStopped,
  isBatchSettled,
  conflictFiles,
}: RebaseParams): RebaseChip => {
  if (isRebaseStopped) {
    return {
      kind: 'autoResolving',
      tone: 'primary',
      text: 'Auto resolving',
      reason: autoReasonOf({ files: conflictFiles }),
      isBreathing: true,
      icon: 'auto',
    };
  }
  if (!isSettled) {
    return {
      kind: 'conflict',
      tone: 'danger',
      text: 'Rebase stopped',
      reason: 'Waiting for Auto',
      isBreathing: false,
      icon: null,
    };
  }
  if (isBatchSettled) {
    return null;
  }
  return {
    kind: 'rebasedByAuto',
    tone: 'success',
    text: 'Rebased by Auto',
    reason: null,
    isBreathing: false,
    icon: 'auto',
  };
};

const rebaseChipOf = (params: RebaseParams): RebaseChip => {
  const { rebase, progress } = params;
  switch (rebase.state) {
    case 'queued':
      return {
        kind: 'queued',
        tone: 'neutral',
        text: 'Queued',
        reason: null,
        isBreathing: false,
        icon: null,
      };
    case 'rebasing':
      return {
        kind: 'rebasing',
        tone: 'info',
        text: 'Rebasing',
        reason: progress,
        isBreathing: true,
        icon: 'git',
      };
    case 'rebased':
      return null;
    case 'conflict':
      return {
        kind: 'conflict',
        tone: 'danger',
        text: 'Rebase stopped',
        reason: null,
        isBreathing: false,
        icon: null,
      };
    case 'auto':
      return autoChipOf(params);
    case 'failed':
      return {
        kind: 'failed',
        tone: 'danger',
        text: 'Failed',
        reason: rebase.message ?? COULDNT_REBASE,
        isBreathing: false,
        icon: null,
      };
    case 'skipped':
      return undefined;
    default: {
      const exhaustive: never = rebase.state;
      return exhaustive;
    }
  }
};

export const branchRowChipOf = ({ signal, rebase, ...rest }: Params): BranchRowChip | null => {
  if (rest.isRebaseStopped && rebase?.state !== 'auto') {
    return {
      kind: 'conflict',
      tone: 'warning',
      text: 'Rebase stopped',
      reason: null,
      isBreathing: false,
      icon: null,
    };
  }
  if (rebase !== null) {
    const chip = rebaseChipOf({ ...rest, rebase });
    if (chip !== undefined) {
      return chip;
    }
  }
  if (signal === null) {
    return null;
  }
  return {
    kind: signal.kind,
    tone: signal.tone,
    text: signal.text,
    reason: null,
    isBreathing: false,
    icon: null,
  };
};
