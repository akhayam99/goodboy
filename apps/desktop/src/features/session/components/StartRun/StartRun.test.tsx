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
import { getSetting } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { runRoutesKey } from '../../startRun/runRoutesSetting';
import { StartRun } from './StartRun';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Refund retries' });
const OTHER = aSession({
  id: brandId<SessionId>({ value: 'session-northwind' }),
  workspaceId: WORKSPACE.id,
  goal: 'Northwind pages',
});
const AGENT = brandId<AgentId>({ value: 'agent-notify-relay' });
const QUESTION = 'Which notify-relay handler fires twice?';
const LAYOUT_ID = brandId<WorkflowId>({ value: 'workflow-layout' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const FIX_A_LAYOUT: Workflow = {
  id: LAYOUT_ID,
  workspaceId: WORKSPACE.id,
  name: 'Fix a layout',
  description: '',
  steps: [
    {
      id: brandId<StepId>({ value: 'step-find' }),
      workflowId: LAYOUT_ID,
      ordinal: 0,
      name: 'Find',
      role: 'scout',
      promptPrefix: '',
    },
    {
      id: brandId<StepId>({ value: 'step-center' }),
      workflowId: LAYOUT_ID,
      ordinal: 1,
      name: 'Center',
      promptPrefix: '',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: NOW,
  updatedAt: NOW,
};

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;
type SpawnFn = StoryState['spawnAgent'];
type SaveFn = StoryState['savePhaseTemplate'];
type AttachFn = StoryState['attachWorkflowToSession'];

const field = () => screen.getByRole('textbox', { name: 'Start a run' });

type RenderParams = {
  readonly sessionId: SessionId;
};

const renderField = ({ sessionId }: RenderParams) =>
  render(
    <ToastProvider>
      <StartRun workspaceId={WORKSPACE.id} sessionId={sessionId} />
    </ToastProvider>,
  );

type AskParams = {
  readonly text: string;
};

const ask = ({ text }: AskParams) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^(Start|Retry)/ }));
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION, OTHER],
    workspaceOverrides: {},
    phaseTemplates: {},
  });
});

afterEach(cleanup);

describe('StartRun', () => {
  it('starts one agent for a question and keeps its route for every window', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });

    ask({ text: QUESTION });

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION.id,
      expect.objectContaining({ kindOverride: 'auto', initialPrompt: QUESTION }),
    );
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({ row: 5, shape: 'lead' });
  });

  it('starts an orchestrated run for a task with an end', async () => {
    const savePhaseTemplate = vi.fn<SaveFn>(async () => FIX_A_LAYOUT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate,
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    renderField({ sessionId: SESSION.id });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(savePhaseTemplate.mock.calls[0]?.[0]).toMatchObject({
      origin: 'orchestrated',
      goal: 'center every member page',
      steps: [],
    });
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      rulesSnapshot: { route: { row: 3, shape: 'plan' } },
    });
  });

  it('seeds a dynamic run with the steps of the preset the ask matches', async () => {
    const savePhaseTemplate = vi.fn<SaveFn>(async () => FIX_A_LAYOUT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate,
      attachWorkflowToSession,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    ask({ text: 'Fix the layout of the Harborline billing page' });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(savePhaseTemplate.mock.calls[0]?.[0]?.processText).toBe(
      'Start from the preset Fix a layout. Its steps, in order:\n1. scout: Find\n2. agent: Center',
    );
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      rulesSnapshot: { route: { row: 2, closeness: 'adapt', presetName: 'Fix a layout' } },
    });
  });

  it('keeps the text and offers Retry when the start fails', async () => {
    useAppStore.setState({
      spawnAgent: vi.fn<SpawnFn>(async () => {
        throw new Error('The provider is cooling down');
      }),
    });
    renderField({ sessionId: SESSION.id });

    ask({ text: QUESTION });

    await screen.findByText(/The provider is cooling down/);
    expect(field()).toHaveProperty('value', QUESTION);
    screen.getByRole('button', { name: 'Retry' });
  });

  it('drops a late answer for a draft of the session it left', async () => {
    let fail: (cause: Error) => void = () => undefined;
    useAppStore.setState({
      spawnAgent: vi.fn<SpawnFn>(
        () =>
          new Promise<AgentId>((_resolve, reject) => {
            fail = reject;
          }),
      ),
    });
    const view = renderField({ sessionId: SESSION.id });
    ask({ text: QUESTION });
    await screen.findByRole('button', { name: /Starting/ });

    view.rerender(
      <ToastProvider>
        <StartRun workspaceId={WORKSPACE.id} sessionId={OTHER.id} />
      </ToastProvider>,
    );
    fail(new Error('The provider is cooling down'));

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(screen.queryByText(/The provider is cooling down/)).toBeNull();
    expect(field()).toHaveProperty('disabled', false);
  });

  it('opens with the text another door hands it', async () => {
    renderField({ sessionId: SESSION.id });

    window.dispatchEvent(
      new CustomEvent(`goodboy:start-run:${SESSION.id}`, { detail: { text: QUESTION } }),
    );

    await waitFor(() => expect(field()).toHaveProperty('value', QUESTION));
  });
});
