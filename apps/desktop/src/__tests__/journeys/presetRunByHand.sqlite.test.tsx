// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { PresetRunPage } from '../../features/session/components/PresetRun';
import { insertWorkspace } from '@goodboy/db';
import type {
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import {
  bindAgentRowsToSqlite,
  createHeldTurns,
  stubProviderRouting,
  type HeldTurns,
} from '../helpers/journeyHarness';
import { summarizerQueues } from '../../store/slices/turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  STORY_NOW,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandedId<WorkflowId>({ value: 'workflow-retry-payments' });
const STEP_NAMES = ['Review', 'Implement', 'Test'] as const;
const AT = brandedId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const stepIdOf = (index: number) => brandedId<StepId>({ value: `step-retry-${index}` });

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: STEP_NAMES.map((name, ordinal) => ({
    id: stepIdOf(ordinal),
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: `${name} the retry changes in payments-api`,
  })),
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

let useAppStore: StoryStore;
let sessionId: SessionId;
let held: HeldTurns;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  for (const step of template.steps) {
    await db.execute(
      'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
      [step.id, WORKFLOW_ID, step.ordinal, step.name, step.promptPrefix],
    );
  }
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    ...connectedAnthropicState(),
  });
  await stubProviderRouting();
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  bindAgentRowsToSqlite();
  held = createHeldTurns({ at: AT, opening: 'Working on the retry changes.' });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Retry payments through ledger-core',
  });
  sessionId = session.id;
});

afterEach(async () => {
  cleanup();
  held.finishAll();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const runIdOfSession = (): WorkflowRunId => {
  const run = useAppStore.getState().sessions.find((entry) => entry.id === sessionId)
    ?.workflowRuns[0];
  if (run === undefined) {
    throw new Error('the run was not attached');
  }
  return run.id;
};

const statuses = async () =>
  rowsOf<{ name: string; status: string }>({
    sql: 'SELECT name, status FROM agents WHERE session_id = ? AND step_id IS NOT NULL ORDER BY ordinal',
    params: [sessionId],
  });

const showPage = (view: RenderResult): string => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  view.rerender(
    <ToastProvider>
      <PresetRunPage
        session={session}
        focus={{ runId: runIdOfSession(), agentId: null }}
        isActive
      />
    </ToastProvider>,
  );
  return view.container.textContent ?? '';
};

const press = ({ view, name }: { readonly view: RenderResult; readonly name: RegExp }) => {
  fireEvent.click(within(view.container).getByRole('button', { name }));
};

const stepStatuses = async () => (await statuses()).map((row) => `${row.name}:${row.status}`);

describe('journey: a preset run advanced by hand', () => {
  it('waits for you between steps, runs the next one when you start it, and finishes', async () => {
    await useAppStore
      .getState()
      .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: false, triggerMode: 'manual' });
    const view = render(<ToastProvider>{null}</ToastProvider>);
    expect(await stepStatuses()).toEqual(['Review:pending', 'Implement:pending', 'Test:pending']);
    const ready = showPage(view);
    expect(ready).toContain('Ready to start');
    expect(held.turns).toHaveLength(0);

    press({ view, name: /Start step 1/ });

    await vi.waitFor(() => expect(held.turns).toHaveLength(1));
    expect(await stepStatuses()).toEqual(['Review:running', 'Implement:pending', 'Test:pending']);
    expect(showPage(view)).toContain('Step 1 · Reviewer is working');

    held.turns[0]?.finish();

    await vi.waitFor(async () =>
      expect(await stepStatuses()).toEqual([
        'Review:completed',
        'Implement:pending',
        'Test:pending',
      ]),
    );
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    expect(held.turns).toHaveLength(1);
    expect(showPage(view)).toContain('Step 1 done · ready to continue');

    press({ view, name: /Start step 2/ });

    await vi.waitFor(() => expect(held.turns).toHaveLength(2));
    expect(await stepStatuses()).toEqual(['Review:completed', 'Implement:running', 'Test:pending']);
    expect(showPage(view)).toContain('Step 2 · Implementer is working');

    held.turns[1]?.finish();

    await vi.waitFor(async () =>
      expect(await stepStatuses()).toEqual([
        'Review:completed',
        'Implement:completed',
        'Test:pending',
      ]),
    );
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    expect(held.turns).toHaveLength(2);
    expect(showPage(view)).toContain('Step 2 done · ready to continue');

    press({ view, name: /Start step 3/ });

    await vi.waitFor(() => expect(held.turns).toHaveLength(3));
    expect(await stepStatuses()).toEqual([
      'Review:completed',
      'Implement:completed',
      'Test:running',
    ]);

    held.turns[2]?.finish();

    await vi.waitFor(async () =>
      expect(await stepStatuses()).toEqual([
        'Review:completed',
        'Implement:completed',
        'Test:completed',
      ]),
    );
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    expect(held.turns).toHaveLength(3);
    const finished = showPage(view);
    expect(finished).toContain('Run finished');
    expect(finished).not.toContain('ready to continue');
    expect(finished).not.toContain('is working');
    expect(within(view.container).queryByRole('button', { name: /Start step/ })).toBeNull();
  });
});
