import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { brandId, type ProjectId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../features/integrations/fetchIssueCandidates';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEDGER_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const RELAY_ID = brandId<ProjectId>({ value: 'project-notify-relay' });
const PAYMENTS_ID = brandId<ProjectId>({ value: 'project-payments-api' });

const harborline = buildStoryWorkspace({
  id: HARBORLINE_ID,
  name: 'Harborline',
  slug: 'harborline',
});
const ledger = buildStoryProject({
  id: LEDGER_ID,
  workspaceId: HARBORLINE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});
const relay = buildStoryProject({
  id: RELAY_ID,
  workspaceId: HARBORLINE_ID,
  name: 'notify-relay',
  rootPath: '/tmp/notify-relay',
});
const payments = buildStoryProject({
  id: PAYMENTS_ID,
  workspaceId: HARBORLINE_ID,
  name: 'payments-api',
  rootPath: '/tmp/payments-api',
  remoteUrl: 'git@github.com:harborline/payments-api.git',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type TextFieldParams = {
  readonly value: unknown;
  readonly key: string;
};

const textField = ({ value, key }: TextFieldParams): string => {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : '';
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 } });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.createWorktree.mockImplementation(async (args: unknown) => {
    const repoPath = textField({ value: args, key: 'repoPath' });
    const branchName = textField({ value: args, key: 'branchName' });
    return {
      worktreePath: `${repoPath}/.goodboy/worktrees/task`,
      branchName: branchName === '' ? 'goodboy/task' : branchName,
      slug: 'task',
      reused: false,
    };
  });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  for (const project of [ledger, relay, payments]) {
    await insertProject({ db, project });
  }
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: HARBORLINE_ID,
    projects: [ledger, relay, payments],
    sessions: [],
    archivedSessions: {},
    sessionDrafts: {},
    ...connectedAnthropicState(),
  });
});

type StartParams = {
  readonly goal: string;
  readonly candidates?: ReadonlyArray<IssueCandidate>;
};

const startTask = async ({ goal, candidates = [] }: StartParams): Promise<SessionId> => {
  const session = await useAppStore.getState().startSessionFromDraft({
    workspaceId: HARBORLINE_ID,
    start: { kind: 'task', candidates, title: goal, goal },
  });
  return session.id;
};

const mountedProjects = async (sessionId: SessionId) =>
  (
    await rowsOf<{ project_id: string }>({
      sql: 'SELECT project_id FROM session_worktrees WHERE session_id = ? ORDER BY project_id',
      params: [sessionId],
    })
  ).map((row) => row.project_id);

const proposedProjects = async (sessionId: SessionId) =>
  (
    await rowsOf<{ payload_json: string }>({
      sql: "SELECT payload_json FROM session_events WHERE session_id = ? AND kind = 'project_materialization_proposed'",
      params: [sessionId],
    })
  ).map((row) => {
    const payload: unknown = JSON.parse(row.payload_json);
    return textField({ value: payload, key: 'projectId' });
  });

describe('store on sqlite: a new session picks the folders its task needs', () => {
  it('mounts the repos the task names, and only those', async () => {
    const sessionId = await startTask({
      goal: 'Move the retry from notify-relay into payments-api',
    });

    expect(await mountedProjects(sessionId)).toEqual([RELAY_ID, PAYMENTS_ID]);
    expect(
      useAppStore.getState().sessionProjectMounts[sessionId]?.map((mount) => mount.projectId),
    ).toEqual([RELAY_ID, PAYMENTS_ID]);
    expect(await proposedProjects(sessionId)).toEqual([]);
  });

  it('mounts the repo of the linked GitHub issue', async () => {
    const sessionId = await startTask({
      goal: 'Stop the double charge',
      candidates: [
        {
          provider: 'github',
          externalId: '12',
          identifier: 'harborline/payments-api#12',
          title: 'Double charge on retry',
          url: 'https://github.com/harborline/payments-api/issues/12',
          goal: 'Stop the double charge',
          body: '',
          branchSlug: 'double-charge',
        },
      ],
    });

    expect(await mountedProjects(sessionId)).toEqual([PAYMENTS_ID]);
  });

  it('asks for a third repo past the allowance instead of mounting it', async () => {
    const sessionId = await startTask({
      goal: 'Rename the account id in ledger-core, notify-relay and payments-api',
    });

    expect(await mountedProjects(sessionId)).toEqual([LEDGER_ID, RELAY_ID]);
    expect(await proposedProjects(sessionId)).toEqual([PAYMENTS_ID]);
  });

  it('keeps a pin in Where over the repos the task names', async () => {
    useAppStore.getState().openSessionDraft();
    useAppStore.getState().patchSessionDraft({
      workspaceId: HARBORLINE_ID,
      patch: { projectIds: [LEDGER_ID] },
    });

    const sessionId = await startTask({ goal: 'Move the retry into notify-relay' });

    expect(await mountedProjects(sessionId)).toEqual([LEDGER_ID]);
    expect(await proposedProjects(sessionId)).toEqual([]);
  });

  it('mounts nothing for a repo name that is not in the workspace', async () => {
    const sessionId = await startTask({ goal: 'Fix the export in billing-core and ledger-cores' });

    expect(await mountedProjects(sessionId)).toEqual([]);
    expect(await proposedProjects(sessionId)).toEqual([]);
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
  });

  it('keeps the session and reports the folder it could not add', async () => {
    storySpies.createWorktree.mockRejectedValueOnce(new Error('disk full'));

    const sessionId = await startTask({ goal: 'Tidy the logs in notify-relay' });

    expect(useAppStore.getState().sessions.map((session) => session.id)).toContain(sessionId);
    expect(await mountedProjects(sessionId)).toEqual([]);
    await vi.waitFor(async () =>
      expect(
        (await rowsOf<{ title: string }>({ sql: 'SELECT title FROM notifications' })).map(
          (row) => row.title,
        ),
      ).toContain("Couldn't add notify-relay to this session"),
    );
  });
});
