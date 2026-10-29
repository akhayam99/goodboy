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
import { getSetting, getWorkspaceValue, insertWorkspace, setSetting } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderId,
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
import type { ProviderDisplayInfo } from '../../../providers/providers';
import { runDefaultKey } from '../../startRun/runDefaultSetting';
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
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
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

  it('starts one Scout at once for @Scout, with no Auto turn first', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({ spawnAgent, attachWorkflowToSession });
    renderField({ sessionId: SESSION.id });

    ask({ text: `@Scout ${QUESTION}` });

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION.id,
      expect.objectContaining({ kindOverride: 'scout', initialPrompt: QUESTION }),
    );
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({ row: 1, shape: 'lead', role: 'scout' });
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

  it('starts a plan from the preset the ask matches, its steps in the rules', async () => {
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
    expect(savePhaseTemplate.mock.calls[0]?.[0]?.processText).toBeUndefined();
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      rulesSnapshot: {
        route: { row: 2, closeness: 'adapt', presetName: 'Fix a layout' },
        preset: {
          workflowId: LAYOUT_ID,
          name: 'Fix a layout',
          steps: [
            { name: 'Find', role: 'scout', isPinned: false },
            { name: 'Center', role: null, isPinned: false },
          ],
        },
      },
    });
  });

  it('reads the session default from the Change menu before any other row', async () => {
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    await setSetting(
      storySqlite(),
      runDefaultKey({ scope: { kind: 'workspace', workspaceId: WORKSPACE.id } }),
      'lead',
    );
    await setSetting(
      storySqlite(),
      runDefaultKey({ scope: { kind: 'session', sessionId: SESSION.id } }),
      'plan',
    );
    renderField({ sessionId: SESSION.id });

    ask({ text: QUESTION });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      rulesSnapshot: { route: { row: 1, shape: 'plan', why: 'your default', ask: QUESTION } },
    });
  });

  it('reads the workspace default from Settings when the session has none', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    await setSetting(
      storySqlite(),
      runDefaultKey({ scope: { kind: 'workspace', workspaceId: WORKSPACE.id } }),
      'lead',
    );
    renderField({ sessionId: SESSION.id });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({ row: 1, why: 'your default' });
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

  it('keeps the file Explore attached, routes it as one file and sends its path', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });

    window.dispatchEvent(
      new CustomEvent(`goodboy:start-run:${SESSION.id}`, {
        detail: {
          text: '',
          file: { relPath: 'src/refunds.ts', absolutePath: '/work/ledger-core/src/refunds.ts' },
        },
      }),
    );
    const attached = await screen.findByRole('group', { name: 'Attached to this run' });
    expect(attached.textContent).toContain('src/refunds.ts');
    ask({ text: 'Tidy the retry loop' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    const prompt = spawnAgent.mock.calls[0]?.[1]?.initialPrompt ?? '';
    expect(prompt.startsWith('Tidy the retry loop')).toBe(true);
    expect(prompt).toContain('- src/refunds.ts (/work/ledger-core/src/refunds.ts)');
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({ row: 5, why: 'One file to look at' });
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Attached to this run' })).toBeNull(),
    );
  });

  it('drops the attached file on Remove and starts without it', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    window.dispatchEvent(
      new CustomEvent(`goodboy:start-run:${SESSION.id}`, {
        detail: { text: '', file: { relPath: 'a.ts', absolutePath: '/work/notify-relay/a.ts' } },
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove a.ts' }));
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]?.initialPrompt).toBe(QUESTION);
  });

  it('opens with the text another door hands it', async () => {
    renderField({ sessionId: SESSION.id });

    window.dispatchEvent(
      new CustomEvent(`goodboy:start-run:${SESSION.id}`, { detail: { text: QUESTION } }),
    );

    await waitFor(() => expect(field()).toHaveProperty('value', QUESTION));
  });
});

type PickParams = {
  readonly label: string;
};

const pickFromMenu = ({ label }: PickParams) => {
  fireEvent.mouseDown(screen.getByText(label));
};

const routeLine = () => document.querySelector('[data-run-route-line]')?.textContent ?? '';

describe('StartRun run as', () => {
  it('opens the role menu on @ and starts the role it picked', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: '@' } });
    pickFromMenu({ label: 'Scout' });

    expect(field()).toHaveProperty('value', '');
    screen.getByRole('button', { name: 'Run as: Agent · Scout' });
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION.id,
      expect.objectContaining({ kindOverride: 'scout', initialPrompt: QUESTION }),
    );
  });

  it('opens the preset menu on ~ and starts a plan from the preset it picked', async () => {
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: '~' } });
    pickFromMenu({ label: 'Fix a layout' });
    ask({ text: QUESTION });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      rulesSnapshot: { route: { row: 1, presetName: 'Fix a layout', closeness: 'follow' } },
    });
  });

  it('says what Start will do before it is pressed and follows the Run as chip', () => {
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    expect(routeLine()).toContain('Starts as Agent · Auto');
    expect(routeLine()).toContain('A question or a check, and no preset fits');

    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));

    expect(routeLine()).toMatch(/^Starts as Workflow · Orchestrated · .+ · you picked it$/);
    screen.getByRole('button', { name: 'Run as: Workflow · Orchestrated' });
  });

  it('shows the Asks you chip for an Auto agent run only', () => {
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    screen.getByText('After the plan');
    screen.getByText('from Cascadia');

    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));

    expect(screen.queryByText('from Cascadia')).toBeNull();
  });

  it('lists Auto, Orchestrated, every preset and every role in the chip', () => {
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });

    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));

    screen.getByRole('button', { name: 'Let Auto pick' });
    screen.getByRole('button', { name: 'Workflow · Orchestrated' });
    screen.getByRole('button', { name: 'Workflow · Preset Fix a layout' });
    screen.getByRole('button', { name: 'Agent · Scout' });
  });

  it('keeps a typed token ahead of the chip', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));

    ask({ text: `@Scout ${QUESTION}` });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'scout' });
  });

  it('writes no Auto limit when a run starts and the person set none', async () => {
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession: vi.fn<AttachFn>(async () => undefined),
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    renderField({ sessionId: SESSION.id });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(
      await getWorkspaceValue({
        db: storySqlite(),
        workspaceId: WORKSPACE.id,
        key: 'auto.treeLimitUsd',
      }),
    ).toBeNull();
  });
});

type ImageParams = {
  readonly name: string;
};

const image = ({ name }: ImageParams): File =>
  new File([new Uint8Array(4)], name, { type: 'image/png' });

describe('StartRun attachments', () => {
  it('attaches a pasted image and sends it with the run kickoff', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const addGoalAttachments = vi.fn<StoryState['addGoalAttachments']>(async () => undefined);
    useAppStore.setState({ spawnAgent, addGoalAttachments });
    renderField({ sessionId: SESSION.id });

    fireEvent.paste(field(), { clipboardData: { files: [image({ name: 'shot.png' })] } });
    await screen.findByText('shot.png');
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(addGoalAttachments).toHaveBeenCalledWith({ type: 'session', id: SESSION.id }, [
      expect.objectContaining({ fileName: 'shot.png', mimeType: 'image/png' }),
    ]);
    expect(addGoalAttachments.mock.invocationCallOrder[0]).toBeLessThan(
      spawnAgent.mock.invocationCallOrder[0] ?? 0,
    );
    await waitFor(() => expect(screen.queryByText('shot.png')).toBeNull());
  });

  it('hands attachments to an orchestrated run too', async () => {
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(screen.getByLabelText('Choose files to attach'), {
      target: { files: [image({ name: 'layout.png' })] },
    });
    await screen.findByText('layout.png');
    ask({ text: 'center every member page' });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]?.attachmentInputs).toEqual([
      expect.objectContaining({ fileName: 'layout.png' }),
    ]);
  });

  it('keeps the attachment and shows the error when the start fails, so Retry sends it again', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const addGoalAttachments = vi
      .fn<StoryState['addGoalAttachments']>()
      .mockRejectedValueOnce(new Error('session worktree not available'))
      .mockResolvedValue(undefined);
    useAppStore.setState({ spawnAgent, addGoalAttachments });
    renderField({ sessionId: SESSION.id });
    fireEvent.paste(field(), { clipboardData: { files: [image({ name: 'shot.png' })] } });
    await screen.findByText('shot.png');

    ask({ text: QUESTION });

    await screen.findByText(/worktree not available/);
    expect(spawnAgent).not.toHaveBeenCalled();
    screen.getByText('shot.png');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(addGoalAttachments).toHaveBeenCalledTimes(2);
  });
});

const modelChip = () => screen.getByRole('button', { name: /^Model:/ });

const providerOf = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  label: id,
  error: null,
  docsUrl: 'https://example.com/docs',
  binary: id,
  capabilities: { models: [] },
  connection: 'connected',
  version: null,
  identity: null,
});

const connectProviders = () =>
  useAppStore.setState({
    providers: [providerOf({ id: 'anthropic' }), providerOf({ id: 'cursor' })],
  });

describe('StartRun model', () => {
  it('shows the model the run will use, Auto until one is picked for this run', () => {
    connectProviders();
    renderField({ sessionId: SESSION.id });

    expect(modelChip().getAttribute('aria-label')).toMatch(/, Auto$/);
    expect(modelChip().getAttribute('data-run-model')).toBe('auto');
  });

  it('puts the model in the route line and follows the Run as chip', () => {
    connectProviders();
    renderField({ sessionId: SESSION.id });
    fireEvent.change(field(), { target: { value: QUESTION } });
    const agentLine = routeLine();

    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));

    expect(agentLine).toContain('Starts as Agent · Auto agent · ');
    expect(routeLine()).toContain('Starts as Workflow · Orchestrated · ');
    expect(modelChip().getAttribute('aria-label')).toContain('Model: ');
  });

  it('starts the Auto agent on the model picked for this run only', async () => {
    connectProviders();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    fireEvent.change(field(), { target: { value: QUESTION } });

    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(modelChip().getAttribute('data-run-model')).toBe('pinned');
    fireEvent.click(screen.getByRole('button', { name: /^(Start|Retry)/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      provider: 'cursor',
    });
    await waitFor(() => expect(modelChip().getAttribute('data-run-model')).toBe('auto'));
  });

  it('starts an orchestrated run with the orchestrator model picked for this run', async () => {
    connectProviders();
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    renderField({ sessionId: SESSION.id });
    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));
    fireEvent.change(field(), { target: { value: 'center every member page' } });

    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    fireEvent.click(screen.getByRole('button', { name: /^(Start|Retry)/ }));

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      orchestratorRouting: { providerId: 'cursor' },
    });
  });

  it('keeps a model picked for one kind off the other kind', async () => {
    connectProviders();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    fireEvent.click(screen.getByRole('button', { name: 'Run as: Let Auto pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));
    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(modelChip().getAttribute('data-run-model')).toBe('pinned');

    fireEvent.click(screen.getByRole('button', { name: 'Run as: Workflow · Orchestrated' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agent · Auto agent' }));

    expect(modelChip().getAttribute('data-run-model')).toBe('auto');
    ask({ text: QUESTION });
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('provider');
  });

  it('links the picker to the default in Settings', () => {
    connectProviders();
    const opened = vi.fn<(event: Event) => void>();
    window.addEventListener('goodboy:open-settings', opened);
    renderField({ sessionId: SESSION.id });

    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Change the default in Settings' }));

    expect(opened).toHaveBeenCalledTimes(1);
    const event = opened.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toMatchObject({
      scope: 'providers',
    });
    window.removeEventListener('goodboy:open-settings', opened);
  });
});
