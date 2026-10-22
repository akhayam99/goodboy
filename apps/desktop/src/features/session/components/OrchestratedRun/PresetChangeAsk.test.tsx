// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type PlanChangeRequest,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { PresetChangeAsk } from './PresetChangeAsk';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Member pages' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-cascadia' });

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

type RunParams = {
  readonly change: PlanChangeRequest;
  readonly isPinned?: boolean;
};

const askedRun = ({ change, isPinned = false }: RunParams): WorkflowRun =>
  aWorkflowRun({
    id: RUN_ID,
    executionMode: 'dynamic',
    orchestrationStop: { kind: 'preset-change', message: 'Auto wants to skip Review' },
    rulesSnapshot: {
      ...DEFAULT_WORKFLOW_RULES,
      preset: {
        workflowId: 'workflow-review',
        name: 'Review a change',
        steps: [{ name: 'Review', role: 'reviewer', promptPrefix: '', isPinned }],
      },
      pendingChange: change,
    },
  });

const SKIP: PlanChangeRequest = { kind: 'skipped', step: 'Review', reason: 'No code changed' };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({ workspaces: [WORKSPACE], sessions: [SESSION] });
});

afterEach(cleanup);

describe('PresetChangeAsk', () => {
  it('asks before a change with the three answers', async () => {
    const resolvePresetChange = vi.fn<StoryState['resolvePresetChange']>(async () => true);
    useAppStore.setState({ resolvePresetChange });
    render(<PresetChangeAsk sessionId={SESSION.id} run={askedRun({ change: SKIP })} />);

    screen.getByText('Auto wants to skip Review');
    screen.getByRole('button', { name: 'Keep it' });
    screen.getByRole('button', { name: 'Switch to adapt' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip it' }));

    await waitFor(() =>
      expect(resolvePresetChange).toHaveBeenCalledWith(SESSION.id, RUN_ID, 'apply'),
    );
  });

  it('offers only Keep the preset for a pinned step', () => {
    render(
      <PresetChangeAsk sessionId={SESSION.id} run={askedRun({ change: SKIP, isPinned: true })} />,
    );

    screen.getByRole('button', { name: 'Keep the preset' });
    expect(screen.queryByRole('button', { name: 'Skip it' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch to adapt' })).toBeNull();
  });

  it('keeps the question and shows why when the answer fails', async () => {
    useAppStore.setState({
      resolvePresetChange: vi.fn<StoryState['resolvePresetChange']>(async () => {
        throw new Error('database is locked');
      }),
    });
    render(<PresetChangeAsk sessionId={SESSION.id} run={askedRun({ change: SKIP })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    await screen.findByText(/database is locked/);
    screen.getByRole('button', { name: 'Skip it' });
  });
});
