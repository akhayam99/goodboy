// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useStartRun } from './index';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Refund retries' });
const AGENT = brandId<AgentId>({ value: 'agent-notify-relay' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-orchestrated' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const GUIDANCE = 'Keep every change inside notify-relay.';
const QUESTION = 'Which notify-relay handler fires twice?';
const TASK = 'center every member page';

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE.id,
  name: 'Orchestrated run',
  description: '',
  steps: [],
  isPreset: false,
  origin: 'orchestrated',
  createdAt: NOW,
  updatedAt: NOW,
};

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;
type SpawnFn = StoryState['spawnAgent'];
type AttachFn = StoryState['attachWorkflowToSession'];

type StartParams = {
  readonly text: string;
  readonly guidance?: string | null;
};

const startWith = async ({ text, guidance }: StartParams): Promise<void> => {
  const { result } = renderHook(
    () =>
      useStartRun({
        workspaceId: WORKSPACE.id,
        sessionId: SESSION.id,
        prepare: async () => ({ usd: null, source: null }),
        ...(guidance !== undefined && { guidance }),
      }),
    { wrapper: ToastProvider },
  );
  act(() => result.current.setText(text));
  await act(async () => {
    await result.current.start();
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: {},
    savePhaseTemplate: vi.fn<StoryState['savePhaseTemplate']>(async () => WORKFLOW),
    generateWorkflowTitle: vi.fn<StoryState['generateWorkflowTitle']>(async () => undefined),
  });
});

afterEach(cleanup);

describe('useStartRun guidance', () => {
  it('hands the guidance to the agent a question starts', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });

    await startWith({ text: QUESTION, guidance: GUIDANCE });

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      initialPrompt: QUESTION,
      guidance: GUIDANCE,
    });
  });

  it('snapshots the guidance in the rules of an orchestrated run', async () => {
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({ attachWorkflowToSession });

    await startWith({ text: TASK, guidance: GUIDANCE });

    expect(attachWorkflowToSession.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: GUIDANCE,
    });
  });

  it('adds nothing to the agent when the form passes no guidance', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });

    await startWith({ text: QUESTION });

    expect(spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('guidance');
  });
});
