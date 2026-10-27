import type { MountId, PullRequestChecks, PullRequestStateKind } from '@goodboy/types';
import type {
  MountRequestView,
  MountRowView,
} from '../../../../store/slices/project-mounts/mountRowModel';
import type { BranchPushState } from '../../../../shared/lib/branchPushState';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { isFresh } from '../../../suggestions/nextStepGates';

export type BranchRequestFacts = Readonly<{
  noun: '#' | '!';
  number: number;
  isDraft: boolean;
  state: PullRequestStateKind;
  checksWord: string | null;
  checks: PullRequestChecks;
  reviewDecision: MountRequestView['reviewDecision'];
  isMergeable: boolean | null;
  isChecksAbsent: boolean;
  isReviewOptional: boolean;
}>;

export type BranchStatusFacts = Readonly<{
  ahead: number | null;
  push: BranchPushState;
  changedFiles: number | null;
  isRebasing: boolean;
}>;

type BranchSeriesFacts = Readonly<{
  name: string;
  position: number;
  total: number | null;
  label: string;
}>;

export type BranchFacts = Readonly<{
  mountId: MountId;
  mountPath: string | null;
  projectName: string;
  branch: string;
  baseBranch: string;
  request: BranchRequestFacts | null;
  behind: number | null;
  isStale: boolean;
  checkedAgo: string | null;
  liveCount: number;
  liveTitle: string | null;
  isFinished: boolean;
  status: BranchStatusFacts | null;
  series: BranchSeriesFacts | null;
}>;

type ChecksParams = {
  readonly checks: PullRequestChecks;
};

const checksWordOf = ({ checks }: ChecksParams): string | null => {
  switch (checks) {
    case 'success':
      return 'checks passing';
    case 'failure':
      return 'checks failing';
    case 'pending':
      return 'checks running';
    case null:
      return null;
    default: {
      const exhaustive: never = checks;
      return exhaustive;
    }
  }
};

type RequestParams = {
  readonly request: MountRequestView;
  readonly isStale: boolean;
};

const requestFactsOf = ({ request, isStale }: RequestParams): BranchRequestFacts => ({
  noun: request.provider === 'gitlab' ? '!' : '#',
  number: request.number,
  isDraft: request.isDraft,
  state: request.state,
  checksWord: isStale ? null : checksWordOf({ checks: request.checks }),
  checks: request.checks,
  reviewDecision: request.reviewDecision,
  isMergeable: request.isMergeable ?? null,
  isChecksAbsent: request.isChecksAbsent === true,
  isReviewOptional: request.isReviewOptional === true,
});

type Params = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly fetchedAtByMountId: ReadonlyMap<string, string | null>;
  readonly behindByMountId: ReadonlyMap<string, number | null>;
  readonly liveCountByMountId: ReadonlyMap<string, number>;
  readonly liveTitleByMountId?: ReadonlyMap<string, string>;
  readonly statusByMountId?: ReadonlyMap<string, BranchStatusFacts>;
  readonly now: number;
};

export const branchFactsOf = ({
  rows,
  fetchedAtByMountId,
  behindByMountId,
  liveCountByMountId,
  liveTitleByMountId = new Map(),
  statusByMountId = new Map(),
  now,
}: Params): ReadonlyArray<BranchFacts> =>
  rows.map((row) => {
    const fetchedAt = fetchedAtByMountId.get(row.mountId) ?? null;
    const isStale = row.request !== null && !isFresh({ fetchedAt, now: () => now });
    const age = formatAge({ from: fetchedAt, now });
    return {
      mountId: row.mountId,
      mountPath: row.worktreePath ?? row.lastWorktreePath,
      projectName: row.projectName,
      branch: row.branch,
      baseBranch: row.baseBranch ?? 'main',
      request: row.request === null ? null : requestFactsOf({ request: row.request, isStale }),
      behind: behindByMountId.get(row.mountId) ?? null,
      isStale,
      checkedAgo: isStale && age !== '' ? age : null,
      liveCount: liveCountByMountId.get(row.mountId) ?? 0,
      liveTitle: liveTitleByMountId.get(row.mountId) ?? null,
      isFinished: row.isFinished,
      status: statusByMountId.get(row.mountId) ?? null,
      series:
        row.series === null
          ? null
          : {
              name: row.series.name,
              position: row.series.position,
              total: row.series.plannedCount,
              label: row.series.label,
            },
    };
  });
