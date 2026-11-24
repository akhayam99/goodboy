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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  getSetting,
  getWorkspaceValue,
  insertSession,
  insertWorkspace,
  setWorkspaceValue,
} from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type ProviderId,
  type SessionId,
  type SessionMountView,
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
import { runRoutesKey } from '../../startRun/runRoutesSetting';
import { startRunEventName } from '../../startRun/startRunEventName';
import { chooseListboxValue } from '../../../../__tests__/helpers/listbox';
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

const PLAN_CHOICES: Readonly<Record<string, string>> = {
  Lead: 'The Lead plans it',
  Preset: 'Follow a workflow',
  Agent: 'One agent',
};

const kindTab = ({ name }: KindParams): HTMLElement =>
  within(screen.getByRole('tablist', { name: 'Plan' })).getByRole('tab', {
    name: PLAN_CHOICES[name] ?? name,
  });

const pickKind = ({ name }: KindParams): void => {
  fireEvent.click(kindTab({ name }));
};

const isPicked = ({ name }: KindParams): boolean =>
  kindTab({ name }).getAttribute('aria-selected') === 'true';

type RenderParams = {
  readonly sessionId: SessionId;
};

const renderField = ({ sessionId }: RenderParams) => {
  const view = render(
    <ToastProvider>
      <StartRun workspaceId={WORKSPACE.id} sessionId={sessionId} />
    </ToastProvider>,
  );
  const change = screen.queryByRole('button', { name: 'Change' });
  if (change !== null) {
    fireEvent.click(change);
  }
  return view;
};

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
  await insertSession(db, SESSION);
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

  it('starts a Lead for a task with an end, never an orchestrated run', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({ spawnAgent, attachWorkflowToSession });
    renderField({ sessionId: SESSION.id });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION.id,
      expect.objectContaining({ kindOverride: 'auto', initialPrompt: 'center every member page' }),
    );
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({ row: 3, shape: 'lead' });
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

  it('opens a chat brief on the same chip row and the one Start button', async () => {
    renderField({ sessionId: SESSION.id });

    window.dispatchEvent(
      new CustomEvent(`goodboy:start-run:${SESSION.id}`, { detail: { text: QUESTION } }),
    );

    await waitFor(() => expect(field()).toHaveProperty('value', QUESTION));
    const group = screen.getByRole('group', { name: 'Run settings' });
    expect(within(group).getAllByRole('button').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /^Start$/ }).hasAttribute('disabled')).toBe(false);
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

  it('opens the preset menu on ~ and gives a Lead the preset it picked as its plan', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      spawnAgent,
      attachWorkflowToSession,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: '~' } });
    pickFromMenu({ label: 'Fix a layout' });
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toContain(
      'Plan: follow the preset "Fix a layout".',
    );
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({
      row: 1,
      presetName: 'Fix a layout',
      closeness: 'follow',
    });
  });

  it('says what Start will do before it is pressed, then what the picked workflow does', () => {
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    expect(routeLine()).toContain('Starts as Lead');
    expect(routeLine()).toContain('A question or a check');

    pickKind({ name: 'Preset' });

    screen.getByText('The Lead starts from Fix a layout and says why when it changes a step.');
    expect(document.querySelector('[data-run-route-line]')).toBeNull();
    expect(isPicked({ name: 'Preset' })).toBe(true);
    expect(document.body.textContent).not.toMatch(/preset/i);
  });

  it('shows the limit chip for a Lead or a preset and none for an agent', () => {
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });

    screen.getByRole('button', { name: 'Limit: none' });

    pickKind({ name: 'Preset' });

    screen.getByRole('button', { name: 'Limit: none' });

    pickKind({ name: 'Agent' });

    expect(screen.queryByRole('button', { name: 'Limit: none' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Limit: / })).toBeNull();
  });

  it('shows the Lead Stops for a Lead and a preset, and none for an agent', async () => {
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(field(), { target: { value: QUESTION } });
    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });

    pickKind({ name: 'Preset' });

    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });
    expect(screen.queryByRole('button', { name: /^Stops for your OK: Every step/ })).toBeNull();

    pickKind({ name: 'Agent' });

    expect(screen.queryByRole('button', { name: /^Stops for your OK/ })).toBeNull();
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

  it('offers three plans, lists the roles on one agent and keeps a workflow for a saved one', () => {
    renderField({ sessionId: SESSION.id });

    expect(
      within(screen.getByRole('tablist', { name: 'Plan' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['The Lead plans it', 'Follow a workflow', 'One agent']);
    expect(isPicked({ name: 'Lead' })).toBe(true);
    expect(kindTab({ name: 'Preset' }).hasAttribute('disabled')).toBe(true);
    cleanup();

    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });
    expect(kindTab({ name: 'Preset' }).hasAttribute('disabled')).toBe(false);
    pickKind({ name: 'Agent' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    screen.getByRole('option', { name: /^Scout/ });
  });

  it('gives a Lead the workflow the Plan row names, free to change its steps', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      spawnAgent,
      attachWorkflowToSession,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    pickKind({ name: 'Preset' });
    screen.getByRole('list', { name: 'Workflow steps' });
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Keep its steps as written' }).checked,
    ).toBe(false);
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({
      shape: 'lead',
      presetName: 'Fix a layout',
      closeness: 'adapt',
    });
  });

  it('keeps the workflow steps as written once the box is checked, and says so', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent, phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });

    pickKind({ name: 'Preset' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep its steps as written' }));
    screen.getByText(/^The Lead runs (the \d+ steps|its one step) as written\.$/);
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
    expect(JSON.parse(raw ?? '{}')[AGENT]).toMatchObject({
      presetName: 'Fix a layout',
      closeness: 'follow',
    });
  });

  it('keeps a typed token ahead of the kind', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent, phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Preset' });

    ask({ text: `@Scout ${QUESTION}` });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'scout' });
  });

  it('starts a preset Lead with the Stops level and the Edits picked', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    const changeAutoLevel = vi.fn<StoryState['changeAutoLevel']>(async () => undefined);
    const setSessionPermissionMode = vi.fn<StoryState['setSessionPermissionMode']>(
      async () => undefined,
    );
    useAppStore.setState({
      spawnAgent,
      attachWorkflowToSession,
      changeAutoLevel,
      setSessionPermissionMode,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Preset' });
    fireEvent.click(await screen.findByRole('button', { name: /^Stops for your OK: (?!Loading)/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /^Never/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Edits:/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Read only/ }));

    ask({ text: 'center every member page' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(changeAutoLevel).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, level: 'run' }),
    );
    expect(setSessionPermissionMode).toHaveBeenCalledWith(SESSION.id, 'plan');
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
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

  it('writes no run default when a run starts and the person set none', async () => {
    useAppStore.setState({ spawnAgent: vi.fn<SpawnFn>(async () => AGENT) });
    renderField({ sessionId: SESSION.id });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]).toBeUndefined();
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
    await screen.findByRole('button', { name: 'Remove shot.png' });
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(addGoalAttachments).toHaveBeenCalledWith({ type: 'session', id: SESSION.id }, [
      expect.objectContaining({ fileName: 'shot.png', mimeType: 'image/png' }),
    ]);
    expect(addGoalAttachments.mock.invocationCallOrder[0]).toBeLessThan(
      spawnAgent.mock.invocationCallOrder[0] ?? 0,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove shot.png' })).toBeNull(),
    );
  });

  it('hands attachments to a Lead that follows a preset too', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const addGoalAttachments = vi.fn<StoryState['addGoalAttachments']>(async () => undefined);
    useAppStore.setState({
      spawnAgent,
      addGoalAttachments,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.change(screen.getByLabelText('Choose files to attach'), {
      target: { files: [image({ name: 'layout.png' })] },
    });
    await screen.findByRole('button', { name: 'Remove layout.png' });
    ask({ text: '~Fix a layout center every member page' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(addGoalAttachments).toHaveBeenCalledWith({ type: 'session', id: SESSION.id }, [
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
    await screen.findByRole('button', { name: 'Remove shot.png' });

    ask({ text: QUESTION });

    await screen.findByText(/worktree not available/);
    expect(spawnAgent).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Remove shot.png' });
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
    const leadLine = routeLine();

    pickKind({ name: 'Agent' });

    expect(leadLine).toContain('Starts as Lead · ');
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

  it('starts a preset Lead on the model picked for this run', async () => {
    connectProviders();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
    useAppStore.setState({
      spawnAgent,
      attachWorkflowToSession,
      phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
    });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Preset' });
    fireEvent.change(field(), { target: { value: 'center every member page' } });

    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    fireEvent.click(screen.getByRole('button', { name: /^(Start|Retry)/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      provider: 'cursor',
    });
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
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
    pickKind({ name: 'Agent' });
    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(modelChip().getAttribute('data-run-model')).toBe('pinned');

    pickKind({ name: 'Lead' });

    expect(modelChip().getAttribute('data-run-model')).toBe('auto');
    ask({ text: QUESTION });
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('provider');
  });

  it('links the picker to its default on Every run, not to Models', () => {
    connectProviders();
    const opened = vi.fn<(event: Event) => void>();
    window.addEventListener('goodboy:open-settings', opened);
    renderField({ sessionId: SESSION.id });

    fireEvent.click(modelChip());
    fireEvent.click(screen.getByRole('button', { name: 'Change the default in Settings' }));

    expect(opened).toHaveBeenCalledTimes(1);
    const event = opened.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toMatchObject({
      scope: 'workspace',
      section: 'general',
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

    for (const name of ['Lead', 'Agent']) {
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

  it('hands the guidance you wrote to the Lead a task with an end starts', async () => {
    withWorkspaceGuidance();
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    edit(RUN_GUIDANCE);

    ask({ text: 'center every member page' });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      guidance: RUN_GUIDANCE,
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
    pickKind({ name: 'Agent' });
    edit(RUN_GUIDANCE);

    pickKind({ name: 'Lead' });

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

describe('StartRun branch', () => {
  const RETRY_BRANCH = 'feat/retry-dedupe';
  const REPLAY_BRANCH = 'feat/replay';

  type MountParams = {
    readonly branch: string;
    readonly isAttached?: boolean;
  };

  const mountOf = ({ branch, isAttached = true }: MountParams): SessionMountView => ({
    id: brandId<MountId>({ value: `mount-${branch}` }),
    sessionId: SESSION.id,
    projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
    worktreePath: `payments-api-${branch}`,
    lastWorktreePath: null,
    branch,
    baseBranch: 'main',
    parallelIndex: 0,
    mountName: 'payments-api',
    repoSlug: 'harborline/payments-api',
    repoRoot: 'payments-api',
    isAttached,
    diskState: 'present',
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });

  type MountsParams = {
    readonly mounts: ReadonlyArray<SessionMountView>;
  };

  const seedMounts = ({ mounts }: MountsParams): void => {
    useAppStore.setState({ sessionMounts: { [SESSION.id]: mounts } });
  };

  const branchChip = (): HTMLElement => screen.getByRole('combobox', { name: 'Branch' });

  type DoorParams = {
    readonly branch: string;
  };

  const openFromBranchRow = ({ branch }: DoorParams): void => {
    act(() => {
      window.dispatchEvent(
        new CustomEvent(startRunEventName({ sessionId: SESSION.id }), {
          detail: { text: '', branch },
        }),
      );
    });
  };

  it('shows no Branch chip when the session has no branch', () => {
    seedMounts({ mounts: [] });
    renderField({ sessionId: SESSION.id });

    expect(screen.queryByRole('combobox', { name: 'Branch' })).toBeNull();
  });

  it('names the one branch of the session and asks nothing more of the Lead', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    seedMounts({ mounts: [mountOf({ branch: RETRY_BRANCH })] });
    renderField({ sessionId: SESSION.id });

    expect(branchChip().textContent).toContain(RETRY_BRANCH);
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ initialPrompt: QUESTION });
  });

  it('starts on the branch the row named, then goes back to any branch', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    seedMounts({
      mounts: [
        mountOf({ branch: RETRY_BRANCH }),
        mountOf({ branch: REPLAY_BRANCH }),
        mountOf({ branch: 'feat/detached', isAttached: false }),
      ],
    });
    renderField({ sessionId: SESSION.id });
    expect(branchChip().textContent).toContain('Any branch');

    openFromBranchRow({ branch: REPLAY_BRANCH });
    expect(branchChip().textContent).toContain(REPLAY_BRANCH);
    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      initialPrompt: `${QUESTION}\n\nWork on the branch ${REPLAY_BRANCH}.`,
    });
    await waitFor(() => expect(branchChip().textContent).toContain('Any branch'));
  });

  it('keeps the picked branch when the start fails, so Retry starts on it', async () => {
    const spawnAgent = vi
      .fn<SpawnFn>()
      .mockRejectedValueOnce(new Error('The provider is cooling down'))
      .mockResolvedValue(AGENT);
    useAppStore.setState({ spawnAgent });
    seedMounts({ mounts: [mountOf({ branch: RETRY_BRANCH }), mountOf({ branch: REPLAY_BRANCH })] });
    renderField({ sessionId: SESSION.id });
    chooseListboxValue({ trigger: branchChip(), value: RETRY_BRANCH });

    ask({ text: QUESTION });

    await screen.findByText(/The provider is cooling down/);
    expect(branchChip().textContent).toContain(RETRY_BRANCH);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(2));
    expect(spawnAgent.mock.calls[1]?.[1]).toMatchObject({
      initialPrompt: `${QUESTION}\n\nWork on the branch ${RETRY_BRANCH}.`,
    });
  });
});
