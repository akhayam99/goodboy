import type {
  MountId,
  MountPullRequestProvider,
  ProjectId,
  SessionId,
  WorktreeStatus,
} from '@goodboy/types';
import { changedCount, distanceAhead, distanceBehind } from '../../../shared/lib/gitStatus';
import type { RemoteHostKind } from '../../../shared/lib/remoteHost';

export type WorktreeRequestPhase = 'open' | 'draft' | 'merged' | 'closed';

export type WorktreeFacts = {
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
  readonly pr: WorktreeRequestPhase | null;
  readonly requestLabel: string | null;
  readonly requestNumber: number | null;
  readonly requestProvider: MountPullRequestProvider | null;
  readonly createProvider: MountPullRequestProvider | null;
  readonly ahead: number;
  readonly unpushed: number;
  readonly behind: number;
  readonly dirty: number;
  readonly isDiverged: boolean;
  readonly isRebasing: boolean;
  readonly comments: number;
  readonly canStartTurnsHere: boolean;
  readonly isDraftAgentRunning: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly editors: ReadonlyArray<WorktreeEditor>;
};

export type WorktreeEditor = {
  readonly binary: string;
  readonly label: string;
};

type RequestParams = {
  readonly state: string;
  readonly isDraft: boolean;
};

const phaseOf = ({ state, isDraft }: RequestParams): WorktreeRequestPhase => {
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
  readonly request: {
    readonly state: string;
    readonly isDraft: boolean;
    readonly label: string;
    readonly number: number;
    readonly provider: MountPullRequestProvider;
  } | null;
  readonly status: WorktreeStatus | null;
  readonly remoteKind: RemoteHostKind | null;
  readonly comments: number;
  readonly canStartTurnsHere: boolean;
  readonly isDraftAgentRunning: boolean;
  readonly blockers: ReadonlyArray<string>;
  readonly editors: ReadonlyArray<WorktreeEditor>;
};

export const worktreeFacts = ({
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
  request,
  status,
  remoteKind,
  comments,
  canStartTurnsHere,
  isDraftAgentRunning,
  blockers,
  editors,
}: Params): WorktreeFacts => {
  const ahead = status === null ? 0 : (distanceAhead({ distance: status.mainDistance }) ?? 0);
  const upstreamAhead =
    status === null ? null : distanceAhead({ distance: status.upstreamDistance });
  const upstreamBehind =
    status === null ? null : distanceBehind({ distance: status.upstreamDistance });
  const isLocalOnly = status !== null && status.upstream === null;
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
    pr: request === null ? null : phaseOf({ state: request.state, isDraft: request.isDraft }),
    requestLabel: request?.label ?? null,
    requestNumber: request?.number ?? null,
    requestProvider: request?.provider ?? null,
    createProvider: remoteKind === null ? null : (CREATABLE[remoteKind] ?? null),
    ahead,
    unpushed: isLocalOnly ? ahead : (upstreamAhead ?? 0),
    behind: status === null ? 0 : (distanceBehind({ distance: status.mainDistance }) ?? 0),
    dirty: status === null ? 0 : (changedCount({ workingTree: status.workingTree }) ?? 0),
    isDiverged: upstreamBehind !== null && upstreamBehind > 0,
    isRebasing: status?.inProgress === 'rebase',
    comments,
    canStartTurnsHere,
    isDraftAgentRunning,
    blockers,
    editors,
  };
};
