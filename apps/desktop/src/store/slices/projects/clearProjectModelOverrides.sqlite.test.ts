import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectById, insertProject, insertWorkspace } from '@goodboy/db';
import type {
  OverrideSettings,
  ProjectId,
  RoleModelPreferences,
  SessionId,
  TaskModelPreferences,
  WorkspaceId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aProject, aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const SIBLING_ID = 'project-ledger-core' as ProjectId;
const SESSION_ID = 'session-payments-retry' as SessionId;

const WORKSPACE_TASKS: TaskModelPreferences = {
  workflow_orchestrator: {
    providerId: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'high',
  },
  summarizer: { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
};

const PROJECT_TASKS: TaskModelPreferences = {
  workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
};

const PROJECT_ROLES: RoleModelPreferences = {
  planner: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  reviewer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  implementer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
};

const PROJECT_OVERRIDES: OverrideSettings = {
  ...EMPTY_OVERRIDES,
  defaultProviderId: 'anthropic',
  taskModels: PROJECT_TASKS,
  roleModels: PROJECT_ROLES,
  providerPool: [{ id: 'anthropic', state: 'on' }],
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' });
  await insertWorkspace({ db, workspace });
  const project = aProject({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'payments-api',
    rootPath: '/tmp/payments-api',
    overrides: PROJECT_OVERRIDES,
  });
  const sibling = aProject({
    id: SIBLING_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: '/tmp/ledger-core',
    overrides: PROJECT_OVERRIDES,
  });
  await insertProject({ db, project });
  await insertProject({ db, project: sibling });
  const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
  useAppStore.setState({
    projects: [project, sibling],
    sessions: [session],
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    workspaceOverrides: {
      [WORKSPACE_ID]: { ...EMPTY_OVERRIDES, taskModels: WORKSPACE_TASKS },
    },
  });
});

const resolvedTasks = () =>
  selectResolvedSettings({ state: useAppStore.getState(), sessionId: SESSION_ID })?.taskModels;

describe('clearProjectModelOverrides on sqlite', () => {
  it('lets the project win while it is mounted, then follows the workspace again', async () => {
    expect(resolvedTasks()?.workflow_orchestrator?.model).toBe('claude-sonnet-5');
    expect(resolvedTasks()?.summarizer?.model).toBe('claude-sonnet-5-5');

    await useAppStore.getState().clearProjectModelOverrides({ projectId: PROJECT_ID });

    expect(resolvedTasks()?.workflow_orchestrator).toEqual({
      providerId: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: 'high',
    });
    const resolved = selectResolvedSettings({
      state: useAppStore.getState(),
      sessionId: SESSION_ID,
    });
    expect(resolved?.roleModels).toBeNull();
  });

  it('writes null to the four columns of that project only', async () => {
    await useAppStore.getState().clearProjectModelOverrides({ projectId: PROJECT_ID });

    const [row] = await rowsOf<{
      task_models: string | null;
      role_models: string | null;
      provider_pool: string | null;
      default_provider_id: string | null;
    }>({
      sql: 'SELECT task_models, role_models, provider_pool, default_provider_id FROM projects WHERE id = ?',
      params: [PROJECT_ID],
    });
    expect(row).toEqual({
      task_models: null,
      role_models: null,
      provider_pool: null,
      default_provider_id: null,
    });
    expect((await getProjectById({ db: storySqlite(), id: SIBLING_ID }))?.overrides).toEqual(
      PROJECT_OVERRIDES,
    );
    expect(
      useAppStore.getState().projects.find((project) => project.id === SIBLING_ID)?.overrides,
    ).toEqual(PROJECT_OVERRIDES);
  });

  it('keeps the store and the row as they were when the write fails, and clears on retry', async () => {
    const before = useAppStore.getState().projects;
    injectDbFault({ match: /UPDATE projects/, message: 'database is locked' });

    await expect(
      useAppStore.getState().clearProjectModelOverrides({ projectId: PROJECT_ID }),
    ).rejects.toThrow('database is locked');

    expect(useAppStore.getState().projects).toBe(before);
    expect(resolvedTasks()?.workflow_orchestrator?.model).toBe('claude-sonnet-5');
    expect(
      (await getProjectById({ db: storySqlite(), id: PROJECT_ID }))?.overrides.taskModels,
    ).toEqual(PROJECT_TASKS);

    await useAppStore.getState().clearProjectModelOverrides({ projectId: PROJECT_ID });
    expect(resolvedTasks()?.workflow_orchestrator?.model).toBe('claude-sonnet-5-5');
  });

  it('refuses a project that is not in the store', async () => {
    await expect(
      useAppStore.getState().clearProjectModelOverrides({ projectId: 'project-gone' as ProjectId }),
    ).rejects.toThrow('project not found: project-gone');
  });
});
