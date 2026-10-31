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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  getSetting,
  getWorkspaceValue,
  insertWorkspace,
  setSetting,
  setWorkspaceValue,
} from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderId,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { providerBudgetStatusFor } from '../../../budget/testing/providerBudgetFixture';
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
const WORKSPACE_GUIDANCE = 'Keep every change inside notify-relay.';
const RUN_GUIDANCE = 'Leave the ledger-core schema alone.';
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

type KindParams = {
  readonly name: string;
};

const kindTab = ({ name }: KindParams): HTMLElement =>
  within(screen.getByRole('tablist', { name: 'What kind of run?' })).getByRole('tab', { name });

const pickKind = ({ name }: KindParams): void => {
  fireEvent.click(kindTab({ name }));
};

const isPicked = ({ name }: KindParams): boolean =>
  kindTab({ name }).getAttribute('aria-selected') === 'true';

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
    expect(isPicked({ name: 'Agent' })).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Role' }).textContent).toContain('Scout');
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

  it('says what Start will do before it is pressed, then what the picked kind does', () => {
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    expect(routeLine()).toContain('Starts as Agent · Auto');
    expect(routeLine()).toContain('A question or a check, and no preset fits');

    pickKind({ name: 'Orchestrated' });

    screen.getByText('Auto plans each next step as it goes.');
    expect(document.querySelector('[data-run-route-line]')).toBeNull();
    expect(isPicked({ name: 'Orchestrated' })).toBe(true);
  });

  it('shows the limit chip for an Auto or workflow kind and none for an agent', () => {
    renderField({ sessionId: SESSION.id });

    screen.getByRole('button', { name: 'No limit' });

    pickKind({ name: 'Orchestrated' });

    screen.getByRole('button', { name: 'No limit' });

    pickKind({ name: 'Agent' });

    expect(screen.queryByRole('button', { name: 'No limit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Limit / })).toBeNull();
  });

  it('shows Asks you for an Auto run and for a workflow, and none for an agent', () => {
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    screen.getByRole('button', { name: 'Asks you: After the plan, from Cascadia' });

    pickKind({ name: 'Orchestrated' });

    screen.getByRole('button', { name: /^Asks you: Every step/ });
    expect(screen.queryByRole('button', { name: /^Asks you: After the plan/ })).toBeNull();

    pickKind({ name: 'Agent' });

    expect(screen.queryByRole('button', { name: /^Asks you/ })).toBeNull();
  });

  it('shows the level the session already has, and a run started untouched keeps it', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    const stored = JSON.stringify({ defaultLevel: 'plan', sessions: { [SESSION.id]: 'step' } });
    await setWorkspaceValue({
      db: storySqlite(),
      workspaceId: WORKSPACE.id,
      key: 'auto.level',
      value: stored,
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });

    await waitFor(() => screen.getByText('Every step'));
    expect(screen.queryByText('After the plan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(
      await getWorkspaceValue({
        db: storySqlite(),
        workspaceId: WORKSPACE.id,
        key: 'auto.level',
      }),
    ).toBe(stored);
  });

  it('shows the workspace default when the session has no level of its own', async () => {
    await setWorkspaceValue({
      db: storySqlite(),
      workspaceId: WORKSPACE.id,
      key: 'auto.level',
      value: JSON.stringify({ defaultLevel: 'run', sessions: {} }),
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });

    await waitFor(() => screen.getByText('Never'));
  });

  it('offers the four kinds, lists the roles on Agent and keeps Preset for a saved preset', () => {
    renderField({ sessionId: SESSION.id });

    expect(
      within(screen.getByRole('tablist', { name: 'What kind of run?' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Auto', 'Agent', 'Orchestrated', 'Preset']);
    expect(kindTab({ name: 'Preset' }).hasAttribute('disabled')).toBe(true);
    cleanup();

    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });
    expect(kindTab({ name: 'Preset' }).hasAttribute('disabled')).toBe(false);
    pickKind({ name: 'Agent' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    screen.getByRole('option', { name: /^Scout/ });
  });

  it('starts a plan from the preset the Preset kind names, following it or adapting', async () => {
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    pickKind({ name: 'Preset' });
    screen.getByRole('list', { name: 'Preset steps' });
    expect(
      screen.getByRole('tab', { name: 'Adapt as it goes' }).getAttribute('aria-selected'),
    ).toBe('true');
    ask({ text: QUESTION });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      rulesSnapshot: { route: { presetName: 'Fix a layout', closeness: 'adapt' } },
    });
  });

  it('keeps a typed token ahead of the kind', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });

    ask({ text: `@Scout ${QUESTION}` });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'scout' });
  });

  it('starts a workflow with the Asks you picked and an agent with the Edits picked', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    const setSessionPermissionMode = vi.fn<StoryState['setSessionPermissionMode']>(
      async () => undefined,
    );
    useAppStore.setState({
      spawnAgent,
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
      attachWorkflowToSession,
      generateWorkflowTitle: vi.fn(async () => undefined),
      setSessionPermissionMode,
    });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    fireEvent.click(screen.getByRole('button', { name: /^Asks you:/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    fireEvent.click(screen.getByRole('button', { name: /^Edits:/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Read only/ }));

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      autoRun: true,
      rulesSnapshot: { autonomy: 'run' },
    });
    expect(setSessionPermissionMode).toHaveBeenCalledWith(SESSION.id, 'plan');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('leaves the session mode alone when no Edits were picked', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const setSessionPermissionMode = vi.fn<StoryState['setSessionPermissionMode']>(
      async () => undefined,
    );
    useAppStore.setState({ spawnAgent, setSessionPermissionMode });
    renderField({ sessionId: SESSION.id });

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(setSessionPermissionMode).not.toHaveBeenCalled();
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

const startOrchestrated = () => {
  const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
  useAppStore.setState({
    savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
    attachWorkflowToSession,
    generateWorkflowTitle: vi.fn(async () => undefined),
  });
  return attachWorkflowToSession;
};

type DefaultLimitParams = {
  readonly usd: string;
};

const storeDefaultLimit = async ({ usd }: DefaultLimitParams) =>
  setWorkspaceValue({
    db: storySqlite(),
    workspaceId: WORKSPACE.id,
    key: 'auto.treeLimitUsd',
    value: usd,
  });

type TypedParams = {
  readonly from: string;
  readonly usd: string;
  readonly shown: string;
};

const typeLimit = async ({ from, usd, shown }: TypedParams): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: from }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Other amount' }), {
    target: { value: usd },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Use this limit' }));
  await screen.findByRole('button', { name: shown });
};

describe('StartRun limit', () => {
  it('starts a run with the default amount the chip showed, tagged as the default', async () => {
    await storeDefaultLimit({ usd: '5' });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: 'Limit $5.00 · default' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 5, limitSource: 'default' });
  });

  it('starts a run with no limit when the chip said No limit, though a default exists', async () => {
    await storeDefaultLimit({ usd: '5' });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    fireEvent.click(await screen.findByRole('button', { name: 'Limit $5.00 · default' }));
    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));
    await screen.findByRole('button', { name: 'No limit' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    const options = attach.mock.calls[0]?.[2];
    expect(options?.spendLimitUsd).toBeNull();
    expect(options?.limitSource).toBeUndefined();
  });

  it('starts a run with the amount typed in the popover, tagged as this run', async () => {
    await storeDefaultLimit({ usd: '5' });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await typeLimit({ from: 'Limit $5.00 · default', usd: '8', shown: 'Limit $8.00' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'run' });
  });

  it('names the session and the provider month in the popover, after the amounts', async () => {
    await storeDefaultLimit({ usd: '5' });
    useAppStore.setState({
      sessionBudgets: {
        [SESSION.id]: { sessionId: SESSION.id, softCapUsd: 20, onExceed: 'pause', warnRatio: 0.8 },
      },
      providerBudgetStatus: {
        anthropic: providerBudgetStatusFor({ spentUsd: 41.2, capUsd: 200 }),
      },
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.click(await screen.findByRole('button', { name: /^Limit / }));

    screen.getByText('Session $0 of $20.00 · Claude $41.20 of $200.00 this month');
  });
});

type RunDefaultParams = {
  readonly usd: number;
};

const withRunDefault = ({ usd }: RunDefaultParams): void => {
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...EMPTY_OVERRIDES,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: usd },
      },
    },
    phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
  });
};

const storedAutoLimit = () =>
  getWorkspaceValue({ db: storySqlite(), workspaceId: WORKSPACE.id, key: 'auto.treeLimitUsd' });

const AUTO_DEFAULT = 'Limit $5.00 · default';
const RUN_DEFAULT = 'Limit $8.00 · default';

describe('StartRun limit by kind', () => {
  beforeEach(async () => {
    await storeDefaultLimit({ usd: '5' });
    withRunDefault({ usd: 8 });
  });

  it.each(['Orchestrated', 'Preset'])(
    'starts %s from the Run defaults limit, tagged as the default',
    async (name) => {
      const attach = startOrchestrated();
      renderField({ sessionId: SESSION.id });
      await screen.findByRole('button', { name: AUTO_DEFAULT });

      pickKind({ name });
      await screen.findByRole('button', { name: RUN_DEFAULT });
      ask({ text: QUESTION });

      await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
      expect(attach.mock.calls[0]?.[2]).toMatchObject({
        spendLimitUsd: 8,
        limitSource: 'default',
      });
      expect(await storedAutoLimit()).toBe('5');
    },
  );

  it('shows the default of the kind just pressed, and no chip on Agent', async () => {
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: AUTO_DEFAULT });

    pickKind({ name: 'Orchestrated' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Auto' });
    screen.getByRole('button', { name: AUTO_DEFAULT });
    pickKind({ name: 'Preset' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Agent' });
    expect(screen.queryByRole('button', { name: /^Limit / })).toBeNull();
  });

  it('starts a no-kind ask from the Auto limit even when the route is a plan', async () => {
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: AUTO_DEFAULT });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 5, limitSource: 'default' });
  });

  it('keeps a typed amount across kinds, starts a workflow with it for this run and never writes the Auto limit', async () => {
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit $3.00' });
    pickKind({ name: 'Auto' });
    screen.getByRole('button', { name: 'Limit $3.00' });
    pickKind({ name: 'Orchestrated' });

    ask({ text: QUESTION });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 3, limitSource: 'run' });
    expect(await storedAutoLimit()).toBe('5');
    screen.getByRole('button', { name: 'Limit $3.00' });
  });

  it('keeps writing the typed amount as the Auto limit when an Auto run starts', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Auto' });
    await typeLimit({ from: AUTO_DEFAULT, usd: '9', shown: 'Limit $9.00' });

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(await storedAutoLimit()).toBe('9');
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

  it('puts the model in the route line and follows the kind', () => {
    connectProviders();
    renderField({ sessionId: SESSION.id });
    fireEvent.change(field(), { target: { value: QUESTION } });
    const agentLine = routeLine();

    pickKind({ name: 'Orchestrated' });

    expect(agentLine).toContain('Starts as Agent · Auto agent · ');
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
    pickKind({ name: 'Orchestrated' });
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

  it('picks the model of a plain Agent from the same chip, for this run only', async () => {
    connectProviders();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Agent' });
    fireEvent.change(field(), { target: { value: QUESTION } });

    expect(modelChip().getAttribute('aria-label')).toMatch(/, Auto$/);
    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(modelChip().getAttribute('data-run-model')).toBe('pinned');
    fireEvent.click(screen.getByRole('button', { name: /^(Start|Retry)/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ provider: 'cursor' });
  });

  it('keeps a model picked for one kind off the other kind', async () => {
    connectProviders();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(modelChip().getAttribute('data-run-model')).toBe('pinned');

    pickKind({ name: 'Auto' });

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

describe('StartRun guidance', () => {
  const withWorkspaceGuidance = (): void => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, standingGuidance: WORKSPACE_GUIDANCE },
        },
      },
      generateWorkflowTitle: vi.fn(async () => undefined),
      savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
    });
  };

  const chip = (): HTMLElement => screen.getByRole('button', { name: /^Guidance:/ });

  const edit = (text: string): void => {
    fireEvent.click(chip());
    fireEvent.change(
      within(screen.getByRole('dialog', { name: 'Guidance for this run' })).getByRole('textbox', {
        name: 'Guidance text',
      }),
      { target: { value: text } },
    );
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
  };

  it('shows the workspace guidance with its tag on every kind', () => {
    withWorkspaceGuidance();
    renderField({ sessionId: SESSION.id });

    for (const name of ['Auto', 'Agent', 'Orchestrated']) {
      pickKind({ name });
      expect(chip().getAttribute('aria-label')).toBe(
        `Guidance: ${WORKSPACE_GUIDANCE}, from Cascadia`,
      );
    }
  });

  it('hands the guidance to the agent a question starts, the workspace one when left alone', async () => {
    withWorkspaceGuidance();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: WORKSPACE_GUIDANCE });
  });

  it('hands the guidance you wrote to a role agent', async () => {
    withWorkspaceGuidance();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Agent' });
    edit(RUN_GUIDANCE);
    expect(chip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'scout',
      guidance: RUN_GUIDANCE,
    });
  });

  it('snapshots the guidance you wrote in the rules of an orchestrated run', async () => {
    withWorkspaceGuidance();
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({ attachWorkflowToSession });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    edit(RUN_GUIDANCE);

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: RUN_GUIDANCE,
    });
  });

  it('sends an empty guidance for No guidance', async () => {
    withWorkspaceGuidance();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'No guidance' }));
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(chip().getAttribute('aria-label')).toBe('Guidance: None, this run');

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: '' });
  });

  it('puts the workspace guidance back with Use workspace guidance', () => {
    withWorkspaceGuidance();
    renderField({ sessionId: SESSION.id });
    edit(RUN_GUIDANCE);

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'Use workspace guidance' }));
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    expect(chip().getAttribute('aria-label')).toBe(
      `Guidance: ${WORKSPACE_GUIDANCE}, from Cascadia`,
    );
  });

  it('keeps the guidance when you switch kind', () => {
    withWorkspaceGuidance();
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    edit(RUN_GUIDANCE);

    pickKind({ name: 'Agent' });
    pickKind({ name: 'Auto' });

    expect(chip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
  });

  it('keeps the guidance when the start fails, and Retry sends it again', async () => {
    withWorkspaceGuidance();
    const spawnAgent = vi
      .fn<SpawnFn>()
      .mockRejectedValueOnce(new Error('The provider is cooling down'))
      .mockResolvedValue(AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    edit(RUN_GUIDANCE);

    ask({ text: QUESTION });

    await screen.findByText(/The provider is cooling down/);
    expect(chip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(2));
    expect(spawnAgent.mock.calls[1]?.[1]).toMatchObject({ guidance: RUN_GUIDANCE });
  });
});
