// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type WorkflowId, type WorkflowRunId } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { PresetRunPage } from '.';

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('PresetRunPage load state', () => {
  it('draws the run skeleton from 120 ms while the workflows load, then nothing if the run is gone', () => {
    const session = aSession();
    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();

    advance(130);
    screen.getByRole('status', { name: 'Loading run' });
    expect(screen.getAllByRole('status', { name: 'Loading steps' })).toHaveLength(3);

    act(() => {
      useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });
    });
    advance(200);
    advance(200);
    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();
  });

  it('draws no skeleton when the workflows are already loaded and the run is missing', () => {
    const session = aSession();
    useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });

    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);
    advance(300);

    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();
  });

  it('says a run that is not in the session is gone', () => {
    const session = aSession();
    useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });

    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    screen.getByText('This run is no longer in this session');
    expect(screen.queryByText('This run could not be read')).toBeNull();
  });
});

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-harborline' });

const RAW_WORKFLOW = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-harborline',
  name: 'Scout, plan, build',
  description: 'Read the code, plan the change, then build it.',
  goal: null,
  processText: null,
  steps: [],
  createdAt: '2026-10-14T09:00:00.000Z',
  updatedAt: '2026-10-14T09:00:00.000Z',
  deletedAt: null,
  isPreset: true,
  origin: null,
};

const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe('PresetRunPage when the run is there and its metadata is not', () => {
  const session = aSession({
    workflowRuns: [aWorkflowRun({ id: RUN_ID, workflowId: WORKFLOW_ID })],
  });

  beforeEach(() => {
    useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });
  });

  it('says the run could not be read, not that it is gone', () => {
    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    screen.getByText('This run could not be read');
    expect(screen.queryByText('This run is no longer in this session')).toBeNull();
  });

  it('keeps the error and the retry when the read fails', async () => {
    stubStoryInvoke({
      workflows_for_session: () => {
        throw new Error('The workflow read failed');
      },
    });
    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();

    screen.getByText(/The workflow read failed/);
    expect((screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(useAppStore.getState().sessionWorkflows[session.id]).toEqual([]);
  });

  it('loads the workflow on retry and leaves the error', async () => {
    stubStoryInvoke({ workflows_for_session: () => [RAW_WORKFLOW] });
    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();

    expect(useAppStore.getState().sessionWorkflows[session.id]?.map(({ id }) => id)).toEqual([
      WORKFLOW_ID,
    ]);
    expect(screen.queryByText('This run could not be read')).toBeNull();
  });
});
