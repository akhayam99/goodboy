import type { GitOperation, GitUnknownReason, WorktreeStatus } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../store';
import { operationLabel, unknownReasonLabel } from '../../../../../shared/lib/gitStatus';

export const hasDiffCounts = ({ diffStat }: { readonly diffStat: MountDiffStat | null }): boolean =>
  diffStat !== null && (diffStat.additions > 0 || diffStat.deletions > 0);

export type MountWorktreeState =
  | { readonly kind: 'reading' }
  | { readonly kind: 'unknown'; readonly reason: GitUnknownReason | null }
  | { readonly kind: 'clean' }
  | { readonly kind: 'modified'; readonly changed: number };

type StateParams = {
  readonly status: WorktreeStatus | null;
  readonly isPending: boolean;
};

type LabelParams = {
  readonly state: MountWorktreeState;
};

type TitleParams = LabelParams & {
  readonly label: string;
};

export const mountWorktreeState = ({ status, isPending }: StateParams): MountWorktreeState => {
  if (status === null) {
    return isPending ? { kind: 'reading' } : { kind: 'unknown', reason: null };
  }
  const workingTree = status.workingTree;
  if (workingTree.kind === 'unknown') {
    return { kind: 'unknown', reason: workingTree.reason };
  }
  if (workingTree.changed > 0) {
    return { kind: 'modified', changed: workingTree.changed };
  }
  return { kind: 'clean' };
};

export const mountWorktreeStateLabel = ({ state }: LabelParams): string => {
  switch (state.kind) {
    case 'reading':
      return 'Reading';
    case 'unknown':
      return 'Unknown';
    case 'clean':
      return 'No changes';
    case 'modified':
      return 'Modified';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const mountWorktreeStateTitle = ({ state, label }: TitleParams): string => {
  switch (state.kind) {
    case 'reading':
      return `Reading the state of ${label}.`;
    case 'unknown':
      return state.reason === null
        ? `The state of ${label} has not been read.`
        : `The state of ${label} is unknown: ${unknownReasonLabel({ reason: state.reason })}.`;
    case 'clean':
      return `${label} has no local modifications.`;
    case 'modified':
      return state.changed === 1
        ? `${label} has 1 locally modified file.`
        : `${label} has ${state.changed} locally modified files.`;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const OPERATION_LABEL = {
  merge: 'Merging',
  rebase: 'Rebasing',
  'cherry-pick': 'Cherry-picking',
  bisect: 'Bisecting',
} satisfies Record<GitOperation, string>;

export type MountOperationView = Readonly<{
  label: string;
  title: string;
}>;

type OperationParams = {
  readonly status: WorktreeStatus | null;
  readonly label: string;
};

export const mountOperationView = ({
  status,
  label,
}: OperationParams): MountOperationView | null => {
  const operation = status?.inProgress ?? null;
  if (operation === null) {
    return null;
  }
  return {
    label: OPERATION_LABEL[operation],
    title: `A ${operationLabel({ operation })} is in progress in ${label}.`,
  };
};
