// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import {
  brandId,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type JiraIntegrationBinding,
  type MountId,
  type PullRequestState,
  type SessionExternalTask,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { deferred } from '../../../features/integrations/testing/deferred';
import { aMountGithub } from '../github/testing/aMountGithub';

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Credit once per event' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger' });
const KEY = 'linear:issue-412';

const JIRA: JiraIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-jira' }),
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-jira' }),
  provider: 'jira',
  config: { siteUrl: 'harborline.atlassian.net', email: 'mara@harborline.test', projectKey: 'HBL' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

type TaskParams = {
  readonly provider: SessionExternalTask['provider'];
  readonly externalId: string;
  readonly identifier: string;
  readonly relation?: SessionExternalTask['relation'];
};

const taskOf = ({
  provider,
  externalId,
  identifier,
  relation,
}: TaskParams): SessionExternalTask => ({
  sessionId: SESSION.id,
  provider,
  externalId,
  identifier,
  url: `https://example.test/${identifier}`,
  title: 'Retried webhooks post a second credit',
  createdAt: TEST_NOW,
  ...(relation === undefined ? {} : { relation }),
});

const LINEAR_TASK = taskOf({ provider: 'linear', externalId: 'issue-412', identifier: 'HBL-412' });
const JIRA_TASK = taskOf({ provider: 'jira', externalId: '10042', identifier: 'HBL-9' });

const mountOf = (): SessionProjectMount => ({
  mountId: MOUNT,
  sessionId: SESSION.id,
  projectId: PROJECT.id,
  mountName: 'ledger-core',
  worktreePath: '/worktrees/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'ak/hbl-412',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const pullRequestOf = (state: PullRequestState['state']): PullRequestState => ({
  number: 418,
  title: 'Reconcile the ledger export',
  url: 'https://github.com/harborline/ledger-core/pull/418',
  state,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/hbl-412',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
});

type Tracker = {
  issueState: { name: string; type: string };
  updates: Array<string>;
  shouldFailNextUpdate: boolean;
  fetches: number;
};

let store: StoryStore;
let linear: Tracker;

const stubLinear = () => {
  stubStoryInvoke({
    linear_fetch_issue: () => {
      linear.fetches += 1;
      return { id: 'issue-412', state: linear.issueState };
    },
    linear_fetch_team_states: [
      { id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1 },
      { id: 'state-progress', name: 'In Progress', type: 'started', position: 2 },
      { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
      { id: 'state-cancelled', name: 'Canceled', type: 'canceled', position: 4 },
    ],
    linear_update_issue_state: (args: unknown) => {
      const stateId =
        typeof args === 'object' && args !== null && 'stateId' in args ? String(args.stateId) : '';
      if (linear.shouldFailNextUpdate) {
        linear.shouldFailNextUpdate = false;
        return Promise.reject(new Error('Linear refused the change'));
      }
      linear.updates.push(stateId);
      return stateId === 'state-done'
        ? { name: 'Done', type: 'completed' }
        : { name: 'In Progress', type: 'started' };
    },
  });
};

const seed = ({
  pr,
  tasks,
}: {
  readonly pr: PullRequestState['state'];
  readonly tasks: ReadonlyArray<SessionExternalTask>;
}) => {
  store.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    projects: [PROJECT],
    sessions: [SESSION],
    sessionProjectMounts: { [SESSION.id]: [mountOf()] },
    sessionExternalTasks: { [SESSION.id]: tasks },
    mountGithub: {
      [MOUNT]: {
        ...aMountGithub({ mountId: MOUNT, projectId: PROJECT.id }),
        pr: pullRequestOf(pr),
      },
    },
    workspaceIntegrations: { [WORKSPACE.id]: [JIRA] },
  });
};

const movesOf = () => store.getState().trackerMoves[SESSION.id] ?? [];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  linear = {
    issueState: { name: 'In Progress', type: 'started' },
    updates: [],
    shouldFailNextUpdate: false,
    fetches: 0,
  };
  stubLinear();
});

describe('the tracker follows the merge', () => {
  it('offers nothing while the pull request is still open, and reads nothing', async () => {
    seed({ pr: 'open', tasks: [LINEAR_TASK] });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
    expect(linear.fetches).toBe(0);
  });

  it('offers the move once the pull request merged, naming the item and both states', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([
      expect.objectContaining({
        key: KEY,
        identifier: 'HBL-412',
        fromName: 'In Progress',
        toName: 'Done',
        workspaceId: WORKSPACE.id,
        target: { kind: 'linear', stateId: 'state-done', fromStateId: 'state-progress' },
      }),
    ]);
    expect(linear.updates).toEqual([]);
  });

  it('offers nothing when the item is already done or canceled', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    linear.issueState = { name: 'Done', type: 'completed' };

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
    linear.issueState = { name: 'Canceled', type: 'canceled' };

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
  });

  it('offers nothing for a closed pull request, a Part of link or a tool with no transition', async () => {
    seed({
      pr: 'closed',
      tasks: [LINEAR_TASK],
    });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    expect(movesOf()).toEqual([]);

    seed({
      pr: 'merged',
      tasks: [
        taskOf({
          provider: 'linear',
          externalId: 'issue-413',
          identifier: 'HBL-413',
          relation: 'part-of',
        }),
        taskOf({ provider: 'github', externalId: '41', identifier: '#41' }),
        taskOf({ provider: 'slack', externalId: 'thread-1', identifier: 'thread' }),
        taskOf({ provider: 'sentry', externalId: 'sentry-1', identifier: 'LEDGER-1' }),
      ],
    });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    expect(movesOf()).toEqual([]);
    expect(linear.fetches).toBe(0);
  });

  it('waits for every branch of the session to finish before it offers the move', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    const second = brandId<MountId>({ value: 'mount-relay' });
    store.setState({
      sessionProjectMounts: {
        [SESSION.id]: [mountOf(), { ...mountOf(), mountId: second, branch: 'ak/hbl-412-part-2' }],
      },
      mountGithub: {
        [MOUNT]: {
          ...aMountGithub({ mountId: MOUNT, projectId: PROJECT.id }),
          pr: pullRequestOf('merged'),
        },
        [second]: {
          ...aMountGithub({ mountId: second, projectId: PROJECT.id }),
          pr: pullRequestOf('open'),
        },
      },
    });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
  });

  it('moves a Jira item through the transition that lands on Done', async () => {
    seed({ pr: 'merged', tasks: [JIRA_TASK] });
    stubStoryInvoke({
      jira_get_issue: {
        id: '10042',
        key: 'HBL-9',
        status: 'In Review',
        statusCategory: 'indeterminate',
      },
      jira_list_transitions: [
        { id: '31', name: 'Back to work', to: { id: '1', name: 'In Progress' }, hasScreen: false },
        { id: '41', name: 'Finish', to: { id: '2', name: 'Done' }, hasScreen: false },
      ],
      jira_transition_issue: null,
    });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([
      expect.objectContaining({
        provider: 'jira',
        fromName: 'In Review',
        toName: 'Done',
        target: { kind: 'jira', transitionId: '41' },
      }),
    ]);
  });

  it('offers nothing for a Jira item whose project has no Done transition', async () => {
    seed({ pr: 'merged', tasks: [JIRA_TASK] });
    stubStoryInvoke({
      jira_get_issue: {
        id: '10042',
        key: 'HBL-9',
        status: 'In Review',
        statusCategory: 'indeterminate',
      },
      jira_list_transitions: [
        { id: '31', name: 'Back to work', to: { id: '1', name: 'In Progress' }, hasScreen: false },
      ],
    });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
  });
});

describe('moving the item', () => {
  const offer = async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
  };

  it('changes the state only after Linear accepted the move, and never offers it again', async () => {
    await offer();

    const result = await store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY });

    expect(result).toMatchObject({ kind: 'moved' });
    expect(linear.updates).toEqual(['state-done']);
    expect(movesOf()).toEqual([]);
    expect(store.getState().trackerMoveSettled[SESSION.id]).toEqual([KEY]);

    linear.issueState = { name: 'In Progress', type: 'started' };
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
  });

  it('writes once and answers both clicks when Move is pressed twice', async () => {
    await offer();

    const [first, second] = await Promise.all([
      store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY }),
      store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY }),
    ]);

    expect(first).toMatchObject({ kind: 'moved' });
    expect(second).toEqual(first);
    expect(linear.updates).toEqual(['state-done']);
  });

  it('keeps the offer and says why when Linear refuses, then moves on a retry', async () => {
    await offer();
    linear.shouldFailNextUpdate = true;

    await expect(
      store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY }),
    ).rejects.toThrow('Linear refused the change');

    expect(movesOf()).toHaveLength(1);
    expect(store.getState().trackerMoveSettled[SESSION.id] ?? []).toEqual([]);

    const retry = await store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY });

    expect(retry).toMatchObject({ kind: 'moved' });
    expect(linear.updates).toEqual(['state-done']);
    expect(movesOf()).toEqual([]);
  });

  it('writes nothing when another window already moved the item', async () => {
    await offer();
    linear.issueState = { name: 'Done', type: 'completed' };

    const result = await store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY });

    expect(result).toEqual({ kind: 'already-done' });
    expect(linear.updates).toEqual([]);
    expect(movesOf()).toEqual([]);
  });

  it('does nothing for an offer that is gone', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });

    const result = await store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY });

    expect(result).toEqual({ kind: 'gone' });
    expect(linear.updates).toEqual([]);
  });

  it('puts the item back to the state it left with Undo', async () => {
    await offer();
    const result = await store.getState().moveTrackerItem({ sessionId: SESSION.id, key: KEY });
    if (result.kind !== 'moved') {
      throw new Error('the move did not run');
    }

    await store.getState().undoTrackerMove({ sessionId: SESSION.id, move: result.move });

    expect(linear.updates).toEqual(['state-done', 'state-progress']);
    expect(store.getState().trackerMoveSettled[SESSION.id]).toEqual([KEY]);
  });

  it('puts a Jira item back through the transition that returns to its old status', async () => {
    seed({ pr: 'merged', tasks: [JIRA_TASK] });
    const writes: Array<string> = [];
    stubStoryInvoke({
      jira_get_issue: {
        id: '10042',
        key: 'HBL-9',
        status: 'In Review',
        statusCategory: 'indeterminate',
      },
      jira_list_transitions: [
        { id: '12', name: 'Reopen', to: { id: '3', name: 'In Review' }, hasScreen: false },
        { id: '41', name: 'Finish', to: { id: '2', name: 'Done' }, hasScreen: false },
      ],
      jira_transition_issue: (args: unknown) => {
        writes.push(
          typeof args === 'object' && args !== null && 'transitionId' in args
            ? String(args.transitionId)
            : '',
        );
        return null;
      },
    });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    const result = await store
      .getState()
      .moveTrackerItem({ sessionId: SESSION.id, key: 'jira:10042' });
    if (result.kind !== 'moved') {
      throw new Error('the move did not run');
    }

    await store.getState().undoTrackerMove({ sessionId: SESSION.id, move: result.move });

    expect(writes).toEqual(['41', '12']);
  });

  it('says so when Jira has no way back', async () => {
    seed({ pr: 'merged', tasks: [JIRA_TASK] });
    stubStoryInvoke({
      jira_get_issue: {
        id: '10042',
        key: 'HBL-9',
        status: 'In Review',
        statusCategory: 'indeterminate',
      },
      jira_list_transitions: [
        { id: '41', name: 'Finish', to: { id: '2', name: 'Done' }, hasScreen: false },
      ],
      jira_transition_issue: null,
    });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    const result = await store
      .getState()
      .moveTrackerItem({ sessionId: SESSION.id, key: 'jira:10042' });
    if (result.kind !== 'moved') {
      throw new Error('the move did not run');
    }

    await expect(
      store.getState().undoTrackerMove({ sessionId: SESSION.id, move: result.move }),
    ).rejects.toThrow('Jira has no way back to In Review from Done.');
  });
});

describe('a late answer', () => {
  it('is dropped when a newer check already told another story', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    const slow = deferred<{
      readonly id: string;
      readonly state: { name: string; type: string };
    }>();
    stubStoryInvoke({
      linear_fetch_issue: () => slow.promise,
      linear_fetch_team_states: [
        { id: 'state-progress', name: 'In Progress', type: 'started', position: 2 },
        { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
      ],
    });
    const first = store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    stubStoryInvoke({
      linear_fetch_issue: { id: 'issue-412', state: { name: 'Done', type: 'completed' } },
      linear_fetch_team_states: [
        { id: 'state-progress', name: 'In Progress', type: 'started', position: 2 },
        { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
      ],
    });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    slow.resolve({ id: 'issue-412', state: { name: 'In Progress', type: 'started' } });
    await first;

    expect(movesOf()).toEqual([]);
  });

  it('is dropped when the person moved the item while the check was reading', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    const slow = deferred<{
      readonly id: string;
      readonly state: { name: string; type: string };
    }>();
    stubStoryInvoke({
      linear_fetch_issue: () => slow.promise,
      linear_fetch_team_states: [
        { id: 'state-progress', name: 'In Progress', type: 'started', position: 2 },
        { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
      ],
    });
    const recheck = store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    store.setState({ trackerMoveSettled: { [SESSION.id]: [KEY] } });

    slow.resolve({ id: 'issue-412', state: { name: 'In Progress', type: 'started' } });
    await recheck;

    expect(movesOf()).toEqual([]);
  });

  it('keeps the offer it already had when a re-read cannot reach the tracker', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    stubStoryInvoke({ linear_fetch_issue: () => Promise.reject(new Error('offline')) });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toHaveLength(1);
  });

  it('forgets the offer when the pull request is no longer merged', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    seed({ pr: 'open', tasks: [LINEAR_TASK] });

    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });

    expect(movesOf()).toEqual([]);
  });
});

describe('the other sessions', () => {
  it('leaves the offers of a session alone while another one is checked', async () => {
    seed({ pr: 'merged', tasks: [LINEAR_TASK] });
    await store.getState().checkTrackerMoves({ sessionId: SESSION.id });
    const other = brandId<SessionId>({ value: 'session-northwind' });

    await store.getState().checkTrackerMoves({ sessionId: other });

    expect(movesOf()).toHaveLength(1);
    expect(store.getState().trackerMoves[other] ?? []).toEqual([]);
  });
});
