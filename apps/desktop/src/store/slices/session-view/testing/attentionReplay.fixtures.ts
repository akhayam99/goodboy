import { brandId, type Agent, type AgentId, type MountId, type Session } from '@goodboy/types';
import type {
  IsoDateTime,
  SessionMountView,
  TurnState,
  Workflow,
  WorkflowId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { GitlabMergeRequest } from '../../../../features/integrations/gitlab/client';
import type { BitbucketPullRequest } from '../../../../features/integrations/bitbucket/client';
import {
  at,
  harborline,
  ledgerCore,
  mountGithubOf,
  mountOf,
  notifyRelay,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../../features/workspace/testing/sessionColumn';
import type { StoryStore } from '../../../storyHarness';
import type {
  MountBitbucketPrState,
  MountGitlabMrState,
  MountRequestState,
} from '../../mount-request/state';
import type { MountGithubState } from '../../../types';
import { sessionById } from '../../sessions/sessionIndex';
import { stageInfoOf } from '../stageInfoOf';

export type ReplayHost = 'github' | 'gitlab' | 'bitbucket';

export type ReplayRequestState = 'open' | 'merged' | 'closed';

export const REPLAY_HOSTS: ReadonlyArray<ReplayHost> = ['github', 'gitlab', 'bitbucket'];

export const REPLAY_TIMES = {
  earlier: '2026-10-06T07:00:00.000Z',
  failed: '2026-10-06T08:00:00.000Z',
  merged: '2026-10-06T09:00:00.000Z',
  afterMerge: '2026-10-06T10:00:00.000Z',
  fetched: '2026-10-06T10:30:00.000Z',
} as const;

export const REPLAY_RELEASE_ID = brandId<WorkflowId>({ value: 'workflow-replay-release' });

export const replayWorkflow = (): Workflow => ({
  id: REPLAY_RELEASE_ID,
  workspaceId: harborline.id,
  name: 'Release checklist',
  description: '',
  steps: [],
  createdAt: at(REPLAY_TIMES.earlier),
  updatedAt: at(REPLAY_TIMES.earlier),
});

type AgentParams = {
  readonly session: Session;
  readonly slug: string;
  readonly status: Agent['status'];
  readonly completedAt?: string;
  readonly startedAt?: string;
  readonly overrides?: Partial<Agent>;
};

export const replayAgent = ({
  session,
  slug,
  status,
  completedAt,
  startedAt,
  overrides = {},
}: AgentParams): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: `agent-replay-${slug}` }),
    sessionId: session.id,
    name: slug,
    status,
    ...(completedAt === undefined ? {} : { completedAt: at(completedAt) }),
    ...(startedAt === undefined ? {} : { startedAt: at(startedAt) }),
    ...overrides,
  });

export const replaySessionOf = ({ goal }: { readonly goal: string }): Session =>
  sessionOf({ goal, state: { kind: 'idle', lastActivityAt: at(REPLAY_TIMES.earlier) } });

export const replayErrorState = (): TurnState => ({
  kind: 'error',
  message: 'The agent stopped',
  failedAt: at(REPLAY_TIMES.failed),
});

export const replayIdleState = (): TurnState => ({
  kind: 'idle',
  lastActivityAt: at(REPLAY_TIMES.afterMerge),
});

type SeedParams = {
  readonly store: StoryStore;
  readonly session: Session;
};

export const seedReplaySession = ({ store, session }: SeedParams): Session => {
  seedColumn({ store, sessions: [session], currentSessionId: session.id });
  store.setState({ sessionWorkflows: { [session.id]: [replayWorkflow()] } });
  return session;
};

type AgentsParams = SeedParams & {
  readonly agents: ReadonlyArray<Agent>;
};

export const seedReplayAgents = ({ store, session, agents }: AgentsParams): void => {
  store.setState((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: agents },
  }));
};

export const replayStageOf = ({ store, session }: SeedParams) => {
  const state = store.getState();
  const fresh = sessionById(state.sessions, session.id) ?? session;
  return stageInfoOf(state, fresh);
};

type MountParams = {
  readonly session: Session;
  readonly project: typeof paymentsApi;
};

export const replayMountViewOf = ({ session, project }: MountParams): SessionMountView => {
  const mount = mountOf({ session, project });
  return {
    id: mount.mountId,
    sessionId: session.id,
    projectId: project.id,
    worktreePath: mount.worktreePath,
    lastWorktreePath: null,
    branch: mount.branch,
    baseBranch: 'main',
    parallelIndex: mount.parallelIndex,
    mountName: project.name,
    repoSlug: `harborline/${project.name}`,
    repoRoot: mount.repoRoot,
    isAttached: true,
    diskState: 'present',
    revision: 1,
    createdAt: at(REPLAY_TIMES.earlier),
    updatedAt: at(REPLAY_TIMES.earlier),
  };
};

export type ReplayRequest = {
  readonly host: ReplayHost;
  readonly project: typeof paymentsApi;
  readonly state: ReplayRequestState | null;
  readonly number?: number;
  readonly fetch?: 'ok' | 'never' | 'failed';
};

const GITLAB_STATES: Record<ReplayRequestState, string> = {
  open: 'opened',
  merged: 'merged',
  closed: 'closed',
};

const BITBUCKET_STATES: Record<ReplayRequestState, BitbucketPullRequest['state']> = {
  open: 'OPEN',
  merged: 'MERGED',
  closed: 'DECLINED',
};

type EntryParams = {
  readonly session: Session;
  readonly request: ReplayRequest;
};

const githubEntryOf = ({ session, request }: EntryParams): MountGithubState => {
  const mount = mountOf({ session, project: request.project });
  const base = mountGithubOf({ mount, number: request.number ?? 301 });
  const isFetched = request.fetch !== 'never' && request.fetch !== 'failed';
  return {
    ...base,
    pr:
      request.state === null || base.pr === null
        ? null
        : { ...base.pr, state: request.state, updatedAt: REPLAY_TIMES.merged },
    fetchedAt: isFetched ? at(REPLAY_TIMES.fetched) : null,
    failedAt: request.fetch === 'failed' ? at(REPLAY_TIMES.fetched) : null,
  };
};

const gitlabEntryOf = ({ session, request }: EntryParams): MountGitlabMrState => {
  const mount = replayMountViewOf({ session, project: request.project });
  const number = request.number ?? 301;
  const mr: GitlabMergeRequest | null =
    request.state === null
      ? null
      : {
          id: 9000 + number,
          iid: number,
          projectId: 9,
          title: 'Retry window',
          description: null,
          state: GITLAB_STATES[request.state],
          webUrl: `https://gitlab.com/harborline/${request.project.name}/-/merge_requests/${number}`,
          sourceBranch: mount.branch,
          targetBranch: 'main',
          draft: false,
          hasConflicts: false,
          mergeStatus: 'can_be_merged',
          updatedAt: REPLAY_TIMES.merged,
        };
  return {
    kind: 'gitlab',
    mountId: mount.id,
    projectId: request.project.id,
    revision: 1,
    host: 'https://gitlab.com',
    projectPath: `harborline/${request.project.name}`,
    branch: mount.branch,
    mrs: mr === null ? [] : [mr],
    links: [],
    mr,
    fetchedAt: request.fetch === 'never' ? null : at(REPLAY_TIMES.fetched),
    loading: false,
    error: null,
  };
};

const bitbucketEntryOf = ({ session, request }: EntryParams): MountBitbucketPrState => {
  const mount = replayMountViewOf({ session, project: request.project });
  const number = request.number ?? 301;
  const pr: BitbucketPullRequest | null =
    request.state === null
      ? null
      : {
          id: number,
          title: 'Retry window',
          description: '',
          state: BITBUCKET_STATES[request.state],
          createdOn: at(REPLAY_TIMES.earlier),
          updatedOn: at(REPLAY_TIMES.merged),
          sourceBranch: mount.branch,
          sourceCommit: null,
          destinationBranch: 'main',
          destinationCommit: null,
          author: null,
          reviewers: [],
          participants: [],
          closeSourceBranch: false,
          mergeCommit: null,
          commentCount: 0,
          taskCount: 0,
          webUrl: `https://bitbucket.org/harborline/${request.project.name}/pull-requests/${number}`,
        };
  return {
    kind: 'bitbucket',
    selected: null,
    mountId: mount.id,
    projectId: request.project.id,
    revision: 1,
    host: 'bitbucket.org',
    repo: null,
    repository: `harborline/${request.project.name}`,
    branch: mount.branch,
    prs: pr === null ? [] : [pr],
    links: [],
    checks: null,
    reviewDecision: null,
    pr,
    fetchedAt: request.fetch === 'never' ? null : at(REPLAY_TIMES.fetched),
    loading: false,
    error: null,
  };
};

type RequestsParams = SeedParams & {
  readonly requests: ReadonlyArray<ReplayRequest>;
};

export const seedReplayRequests = ({ store, session, requests }: RequestsParams): void => {
  const views = requests.map((request) => replayMountViewOf({ session, project: request.project }));
  const github: Record<MountId, MountGithubState> = {};
  const hosted: Record<MountId, MountRequestState> = {};
  requests.forEach((request, index) => {
    const view = views[index];
    if (view === undefined) {
      return;
    }
    if (request.host === 'github') {
      github[view.id] = githubEntryOf({ session, request });
      return;
    }
    hosted[view.id] =
      request.host === 'gitlab'
        ? gitlabEntryOf({ session, request })
        : bitbucketEntryOf({ session, request });
  });
  store.setState((state) => ({
    sessionMounts: { ...state.sessionMounts, [session.id]: views },
    mountGithub: github,
    mountRequests: hosted,
  }));
};

export const REPLAY_PROJECTS = { paymentsApi, ledgerCore, notifyRelay } as const;

export const REPLAY_TOUCH: IsoDateTime = at(REPLAY_TIMES.afterMerge);
