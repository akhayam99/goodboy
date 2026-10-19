import {
  brandId,
  type MountId,
  type ProjectId,
  type PullRequestChecks,
  type PullRequestStateKind,
} from '@goodboy/types';
import type {
  MountRequestView,
  MountRowView,
} from '../../../../../store/slices/project-mounts/mountRowModel';

type RequestParams = {
  readonly provider: MountRequestView['provider'];
  readonly number: number;
  readonly state?: PullRequestStateKind;
  readonly isDraft?: boolean;
  readonly checks?: PullRequestChecks;
  readonly reviewDecision?: MountRequestView['reviewDecision'];
  readonly isMergeable?: boolean | null;
  readonly isChecksAbsent?: boolean;
  readonly isReviewOptional?: boolean;
};

export const aRequest = ({
  provider,
  number,
  state = 'open',
  isDraft = false,
  checks = null,
  reviewDecision = null,
  isMergeable = null,
  isChecksAbsent = false,
  isReviewOptional = false,
}: RequestParams): MountRequestView => ({
  provider,
  identity: null,
  number,
  state,
  isDraft,
  checks,
  reviewDecision,
  isMergeable,
  isChecksAbsent,
  isReviewOptional,
  url: `https://example.test/${provider}/${number}`,
  title: 'Per-tenant limits on payouts',
  label: provider === 'gitlab' ? `MR !${number}` : `PR #${number}`,
});

type Params = {
  readonly key: string;
  readonly projectName: string;
  readonly branch: string;
  readonly request?: MountRequestView | null;
};

export const aMountRow = ({ key, projectName, branch, request = null }: Params): MountRowView => ({
  mountId: brandId<MountId>({ value: `mount-${key}` }),
  projectId: brandId<ProjectId>({ value: `project-${key}` }),
  projectName,
  projectKind: 'repo',
  mountName: projectName,
  branch,
  baseBranch: 'main',
  worktreePath: `/work/${key}`,
  lastWorktreePath: `/work/${key}`,
  repoRoot: `/repos/${key}`,
  isAttached: true,
  isMainCheckout: false,
  isOnDisk: true,
  revision: 1,
  parallelIndex: 0,
  request,
  series: null,
  observation: null,
  observedBranchHolder: null,
  isFinished: false,
});
