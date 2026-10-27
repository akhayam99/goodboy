// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import type { MountGithubState, SessionGithubState } from '../../types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { MountGitlabMrState, SessionGitlabMrState } from '../gitlab-mr/state';
import { inactivityInputsOf, type InactivityInputsState } from './inactivityInputsOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger' });

type AgentPatch = {
  readonly patch?: Partial<Agent>;
};

type PrParams = {
  readonly updatedAt: string;
};

type StatePatch = {
  readonly patch?: Partial<InactivityInputsState>;
};

const agentOf = ({ patch = {} }: AgentPatch = {}): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Implement',
  status: 'completed',
  startedAt: brandId<IsoDateTime>({ value: '2026-10-01T09:00:00.000Z' }),
  lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-02T09:00:00.000Z' }),
  ...patch,
});

const prOf = ({ updatedAt }: PrParams): PullRequestState => ({
  number: 318,
  title: 'Reconcile the ledger export',
  url: 'https://github.com/acme/ledger-core/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'acme/ledger-export',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt,
});

const githubOf = ({ updatedAt }: PrParams): SessionGithubState => ({
  pr: prOf({ updatedAt }),
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  mountName: 'ledger-core',
  worktreePath: '/tmp/ledger-core/worktrees/session-ledger',
  lastWorktreePath: null,
  repoRoot: '/tmp/ledger-core',
  branch: 'acme/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const mountGithubOf = ({ updatedAt }: PrParams): MountGithubState => ({
  ...githubOf({ updatedAt: '2026-09-01T09:00:00.000Z' }),
  pr: null,
  mountId: MOUNT_ID,
  projectId: MOUNT.projectId,
  revision: 1,
  repository: null,
  host: null,
  branch: MOUNT.branch,
  prs: [prOf({ updatedAt })],
  links: [],
});

const mrOf = ({ updatedAt }: PrParams): GitlabMergeRequest => ({
  id: 7,
  iid: 42,
  projectId: 9,
  title: 'Reconcile the ledger export',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/ledger-core/-/merge_requests/42',
  sourceBranch: 'acme/ledger-export',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt,
});

const gitlabOf = ({ updatedAt }: PrParams): SessionGitlabMrState => ({
  mr: mrOf({ updatedAt }),
  fetchedAt: null,
  loading: false,
  error: null,
});

const mountGitlabOf = ({ updatedAt }: PrParams): MountGitlabMrState => ({
  ...gitlabOf({ updatedAt: '2026-09-01T09:00:00.000Z' }),
  mr: null,
  mountId: MOUNT_ID,
  projectId: MOUNT.projectId,
  revision: 1,
  host: null,
  projectPath: null,
  branch: MOUNT.branch,
  mrs: [mrOf({ updatedAt })],
  links: [],
});

const stateOf = ({ patch = {} }: StatePatch = {}): InactivityInputsState => ({
  sessionPhaseRuns: { [SESSION_ID]: [agentOf()] },
  agentDraft: {},
  agentQueue: {},
  sessionGithub: {},
  mountGithub: {},
  sessionGitlabMr: {},
  mountGitlabMr: {},
  sessionProjectMounts: {},
  ...patch,
});

describe('inactivityInputsOf', () => {
  it('takes the latest agent stamp as the last activity it saw', () => {
    const result = inactivityInputsOf({ state: stateOf(), sessionId: SESSION_ID });

    expect(result).toEqual({
      seenActivityAt: Date.parse('2026-10-02T09:00:00.000Z'),
      requestEndedAt: null,
      personTurnAt: Date.parse('2026-10-02T09:00:00.000Z'),
      isQueued: false,
      hasDraft: false,
    });
  });

  it('counts the user viewing an agent and an agent stopped', () => {
    const state = stateOf({
      patch: {
        sessionPhaseRuns: {
          [SESSION_ID]: [
            agentOf({
              patch: {
                lastViewedAt: brandId<IsoDateTime>({ value: '2026-10-04T09:00:00.000Z' }),
                stoppedAt: brandId<IsoDateTime>({ value: '2026-10-03T09:00:00.000Z' }),
              },
            }),
          ],
        },
      },
    });

    expect(inactivityInputsOf({ state, sessionId: SESSION_ID }).seenActivityAt).toBe(
      Date.parse('2026-10-04T09:00:00.000Z'),
    );
  });

  it('counts a pull request event on the session and on one of its mounts', () => {
    const sessionGithub = {
      [SESSION_ID]: githubOf({ updatedAt: '2026-10-05T09:00:00.000Z' }),
    };
    expect(
      inactivityInputsOf({ state: stateOf({ patch: { sessionGithub } }), sessionId: SESSION_ID })
        .seenActivityAt,
    ).toBe(Date.parse('2026-10-05T09:00:00.000Z'));

    const state = stateOf({
      patch: {
        sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
        mountGithub: { [MOUNT_ID]: mountGithubOf({ updatedAt: '2026-10-06T09:00:00.000Z' }) },
      },
    });
    expect(inactivityInputsOf({ state, sessionId: SESSION_ID }).seenActivityAt).toBe(
      Date.parse('2026-10-06T09:00:00.000Z'),
    );
  });

  it('counts a merge request event on the session and on one of its mounts', () => {
    const sessionGitlabMr = {
      [SESSION_ID]: gitlabOf({ updatedAt: '2026-10-05T09:00:00.000Z' }),
    };
    expect(
      inactivityInputsOf({ state: stateOf({ patch: { sessionGitlabMr } }), sessionId: SESSION_ID })
        .seenActivityAt,
    ).toBe(Date.parse('2026-10-05T09:00:00.000Z'));

    const state = stateOf({
      patch: {
        sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
        mountGitlabMr: { [MOUNT_ID]: mountGitlabOf({ updatedAt: '2026-10-06T09:00:00.000Z' }) },
      },
    });
    expect(inactivityInputsOf({ state, sessionId: SESSION_ID }).seenActivityAt).toBe(
      Date.parse('2026-10-06T09:00:00.000Z'),
    );
  });

  it('says a session holds a queued message or an unsent draft', () => {
    const queued = stateOf({
      patch: {
        agentQueue: {
          [AGENT_ID]: [
            {
              id: 'queued-1',
              agentId: AGENT_ID,
              content: 'Use the queue',
              attachments: [],
              override: undefined,
              status: 'queued',
              createdAt: brandId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
            },
          ],
        },
      },
    });
    expect(inactivityInputsOf({ state: queued, sessionId: SESSION_ID }).isQueued).toBe(true);

    const drafted = stateOf({
      patch: { agentDraft: { [AGENT_ID]: 'Check the settlement dates' } },
    });
    expect(inactivityInputsOf({ state: drafted, sessionId: SESSION_ID }).hasDraft).toBe(true);

    const blank = stateOf({ patch: { agentDraft: { [AGENT_ID]: '   ' } } });
    expect(inactivityInputsOf({ state: blank, sessionId: SESSION_ID }).hasDraft).toBe(false);
  });

  it('sees nothing for a session with no agents', () => {
    expect(
      inactivityInputsOf({
        state: stateOf({ patch: { sessionPhaseRuns: {} } }),
        sessionId: SESSION_ID,
      }),
    ).toEqual({
      seenActivityAt: null,
      requestEndedAt: null,
      personTurnAt: null,
      isQueued: false,
      hasDraft: false,
    });
  });

  it('takes the end of a merged or closed pull request, never an open one', () => {
    const open = githubOf({ updatedAt: '2026-10-05T09:00:00.000Z' });
    const merged: SessionGithubState = {
      ...open,
      pr: {
        ...prOf({ updatedAt: '2026-10-07T09:00:00.000Z' }),
        state: 'merged',
        mergedAt: '2026-10-06T09:00:00.000Z',
      },
    };

    expect(
      inactivityInputsOf({
        state: stateOf({ patch: { sessionGithub: { [SESSION_ID]: open } } }),
        sessionId: SESSION_ID,
      }).requestEndedAt,
    ).toBeNull();
    expect(
      inactivityInputsOf({
        state: stateOf({ patch: { sessionGithub: { [SESSION_ID]: merged } } }),
        sessionId: SESSION_ID,
      }).requestEndedAt,
    ).toBe(Date.parse('2026-10-06T09:00:00.000Z'));
  });

  it('takes the end of a closed GitLab merge request on a mount', () => {
    const closed: MountGitlabMrState = {
      ...mountGitlabOf({ updatedAt: '2026-10-08T09:00:00.000Z' }),
      mrs: [{ ...mrOf({ updatedAt: '2026-10-08T09:00:00.000Z' }), state: 'closed' }],
    };
    const state = stateOf({
      patch: {
        sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
        mountGitlabMr: { [MOUNT_ID]: closed },
      },
    });

    expect(inactivityInputsOf({ state, sessionId: SESSION_ID }).requestEndedAt).toBe(
      Date.parse('2026-10-08T09:00:00.000Z'),
    );
  });

  it('counts the turns of a conversation agent as the person writing, not a background one', () => {
    const state = stateOf({
      patch: {
        sessionPhaseRuns: {
          [SESSION_ID]: [
            agentOf(),
            agentOf({
              patch: {
                id: brandId<AgentId>({ value: 'agent-resolver' }),
                kind: 'resolver',
                lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-09T09:00:00.000Z' }),
              },
            }),
            agentOf({
              patch: {
                id: brandId<AgentId>({ value: 'agent-child' }),
                parentAgentId: AGENT_ID,
                lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
              },
            }),
          ],
        },
      },
    });

    expect(inactivityInputsOf({ state, sessionId: SESSION_ID }).personTurnAt).toBe(
      Date.parse('2026-10-02T09:00:00.000Z'),
    );
  });
});
