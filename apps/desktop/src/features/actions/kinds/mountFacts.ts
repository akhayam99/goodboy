import type {
  MountId,
  MountPullRequestProvider,
  ProjectId,
  SessionId,
  WorkflowRunId,
  WorktreeStatus,
} from '@goodboy/types';
import type { OnlineCommit } from '../../../store/runtime/worktreeStatuses/onlyOnline';
import {
  changedCount,
  distanceAhead,
  distanceBehind,
  mainBehindOf,
} from '../../../shared/lib/gitStatus';
import { branchPushFactsOf } from '../../../shared/lib/branchPushState';
import type { RemoteHostKind } from '../../../shared/utils/remoteHost';

type MountRequestPhase = 'open' | 'draft' | 'merged' | 'closed';

export type MountFacts = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly label: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly mountBaseBranch: string | null;
  readonly worktreePath: string | null;
  readonly keptPath: string | null;
  readonly isRepo: boolean;
  readonly isClosed: boolean;
  readonly isBranchGone: boolean;
  readonly canRestoreBranch: boolean;
  readonly pr: MountRequestPhase | null;
  readonly requestLabel: string | null;
  readonly mergedHeadSha?: string | null;
  readonly requestNumber: number | null;
  readonly requestProvider: MountPullRequestProvider | null;
  readonly createProvider: MountPullRequestProvider | null;
  readonly ahead: number;
  readonly unpushed: number;
  readonly behind: number;
  readonly dirty: number;
  readonly isDiverged: boolean;
  readonly onlyOnline: ReadonlyArray<OnlineCommit> | null;
  readonly isRebasing: boolean;
  readonly rebaseConflict: MountRebaseConflict | null;
  readonly autoBlockedReason: string | null;
  readonly comments: number;
  readonly canStartTurnsHere: boolean;
  readonly isScribeWriting: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly pinnedRunIds: ReadonlyArray<WorkflowRunId>;
  readonly pinnedRunLabel: string | null;
  readonly editors: ReadonlyArray<MountEditor>;
};

export type MountRebaseConflict = {
  readonly isWithAuto: boolean;
  readonly count: number;
};

type MountEditor = {
  readonly binary: string;
  readonly label: string;
};

type RequestParams = {
  readonly state: string;
  readonly isDraft: boolean;
};

const phaseOf = ({ state, isDraft }: RequestParams): MountRequestPhase => {
  if (state === 'merged' || state === 'closed') {
    return state;
  }
  return isDraft || state === 'draft' ? 'draft' : 'open';
};

const CREATABLE: Readonly<Partial<Record<RemoteHostKind, MountPullRequestProvider>>> = {
  github: 'github',
  gitlab: 'gitlab',
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly label: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly mountBaseBranch: string | null;
  readonly worktreePath: string | null;
  readonly keptPath: string | null;
  readonly isRepo: boolean;
  readonly isAttached: boolean;
  readonly isBranchGone: boolean;
  readonly canRestoreBranch: boolean;
  readonly request: {
    readonly state: string;
    readonly isDraft: boolean;
    readonly label: string;
    readonly number: number;
    readonly provider: MountPullRequestProvider;
    readonly mergedHeadSha?: string | null;
  } | null;
  readonly status: WorktreeStatus | null;
  readonly remoteKind: RemoteHostKind | null;
  readonly comments: number;
  readonly canStartTurnsHere: boolean;
  readonly isScribeWriting: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly pinnedRunIds: ReadonlyArray<WorkflowRunId>;
  readonly pinnedRunLabel: string | null;
  readonly editors: ReadonlyArray<MountEditor>;
  readonly onlyOnline: ReadonlyArray<OnlineCommit> | null;
  readonly rebaseConflict: MountRebaseConflict | null;
  readonly autoBlockedReason: string | null;
};

export const mountFacts = ({
  sessionId,
  mountId,
  projectId,
  label,
  branch,
  baseBranch,
  mountBaseBranch,
  worktreePath,
  keptPath,
  isRepo,
  isAttached,
  isBranchGone,
  canRestoreBranch,
  request,
  status,
  remoteKind,
  comments,
  canStartTurnsHere,
  isScribeWriting,
  blockers,
  pinnedRunIds,
  pinnedRunLabel,
  editors,
  onlyOnline,
  rebaseConflict,
  autoBlockedReason,
}: Params): MountFacts => {
  const ahead = status === null ? 0 : (distanceAhead({ distance: status.mainDistance }) ?? 0);
  const push = branchPushFactsOf({ status });
  const upstreamBehind =
    status === null ? null : distanceBehind({ distance: status.upstreamDistance });
  const isDone = request?.state === 'merged' || request?.state === 'closed';
  return {
    sessionId,
    mountId,
    projectId,
    label,
    branch,
    baseBranch,
    mountBaseBranch,
    worktreePath: isAttached ? worktreePath : null,
    keptPath,
    isRepo,
    isClosed: !isAttached,
    isBranchGone: !isAttached && isBranchGone,
    canRestoreBranch: !isAttached && isBranchGone && canRestoreBranch,
    pr: request === null ? null : phaseOf({ state: request.state, isDraft: request.isDraft }),
    requestLabel: request?.label ?? null,
    mergedHeadSha: request?.mergedHeadSha ?? null,
    requestNumber: request?.number ?? null,
    requestProvider: request?.provider ?? null,
    createProvider: remoteKind === null ? null : (CREATABLE[remoteKind] ?? null),
    ahead,
    unpushed: push.toPush,
    behind: mainBehindOf({ status, isDone }) ?? 0,
    dirty: status === null ? 0 : (changedCount({ workingTree: status.workingTree }) ?? 0),
    isDiverged: upstreamBehind !== null && upstreamBehind > 0,
    onlyOnline,
    isRebasing: !isDone && status?.inProgress === 'rebase',
    rebaseConflict: isDone ? null : rebaseConflict,
    autoBlockedReason,
    comments,
    canStartTurnsHere,
    isScribeWriting,
    blockers,
    pinnedRunIds,
    pinnedRunLabel,
    editors,
  };
};
