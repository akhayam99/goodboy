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
import { getSetting, insertWorkspace, setSetting } from '@goodboy/db';
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

type KindParams = {
  readonly name: string;
};

const kindTab = ({ name }: KindParams): HTMLElement => {
  if (screen.queryByRole('tablist', { name: 'What kind of run?' }) === null) {
    fireEvent.click(screen.getByRole('button', { name: /^How: / }));
  }
  return within(screen.getByRole('tablist', { name: 'What kind of run?' })).getByRole('tab', {
    name: new RegExp(`^${name}`),
  });
};

const pickKind = ({ name }: KindParams): void => {
  fireEvent.click(kindTab({ name }));
};

type RenderParams = {
  readonly sessionId: SessionId;
};

const renderField = ({ sessionId }: RenderParams) => {
  const view = render(
    <ToastProvider>
      <StartRun workspaceId={WORKSPACE.id} sessionId={sessionId} />
    </ToastProvider>,
  );
  const more = screen.queryByRole('button', { name: /^More/ });
  if (more !== null) {
    fireEvent.click(more);
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
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: {},
  });
});

afterEach(cleanup);

const startOrchestrated = () => {
  const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
  useAppStore.setState({
    savePhaseTemplate: vi.fn<SaveFn>(async () => FIX_A_LAYOUT),
    attachWorkflowToSession,
    generateWorkflowTitle: vi.fn(async () => undefined),
  });
  return attachWorkflowToSession;
};

type RunDefaultParams = {
  readonly usd: number;
};

const storeDefaultLimit = ({ usd }: RunDefaultParams): void => {
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...EMPTY_OVERRIDES,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: usd },
      },
    },
  });
};

const storedRunLimit = () =>
  useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules?.spendLimitUsd;

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
    storeDefaultLimit({ usd: 5 });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: 'Limit: $5.00 · default' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 5, limitSource: 'default' });
  });

  it('starts a run with no limit when the chip said No limit, though a default exists', async () => {
    storeDefaultLimit({ usd: 5 });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    fireEvent.click(await screen.findByRole('button', { name: 'Limit: $5.00 · default' }));
    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));
    await screen.findByRole('button', { name: 'Limit: none' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    const options = attach.mock.calls[0]?.[2];
    expect(options?.spendLimitUsd).toBeNull();
    expect(options?.limitSource).toBeUndefined();
  });

  it('starts a run with the amount typed in the popover, tagged as this run', async () => {
    storeDefaultLimit({ usd: 5 });
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await typeLimit({ from: 'Limit: $5.00 · default', usd: '8', shown: 'Limit: $8.00' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'run' });
  });

  it('names the session and the provider month in the popover, after the amounts', async () => {
    storeDefaultLimit({ usd: 5 });
    useAppStore.setState({
      sessionBudgets: {
        [SESSION.id]: { sessionId: SESSION.id, softCapUsd: 20, onExceed: 'pause', warnRatio: 0.8 },
      },
      providerBudgetStatus: {
        anthropic: providerBudgetStatusFor({ spentUsd: 41.2, capUsd: 200 }),
      },
    });
    renderField({ sessionId: SESSION.id });

    fireEvent.click(await screen.findByRole('button', { name: /^Limit: / }));

    screen.getByText('Session $0 of $20.00 · Claude $41.20 of $200.00 this month');
  });
});

const RUN_DEFAULT = 'Limit: $8.00 · default';

describe('StartRun limit by kind', () => {
  beforeEach(() => {
    storeDefaultLimit({ usd: 8 });
    useAppStore.setState({ phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] } });
  });

  it.each(['Orchestrated', 'Preset'])(
    'starts %s from the Run defaults limit, tagged as the default',
    async (name) => {
      const attach = startOrchestrated();
      renderField({ sessionId: SESSION.id });

      pickKind({ name });
      await screen.findByRole('button', { name: RUN_DEFAULT });
      ask({ text: QUESTION });

      await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
      expect(attach.mock.calls[0]?.[2]).toMatchObject({
        spendLimitUsd: 8,
        limitSource: 'default',
      });
    },
  );

  it('shows the Run defaults limit on every kind, and no chip on Agent', async () => {
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: RUN_DEFAULT });

    pickKind({ name: 'Orchestrated' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Auto' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Preset' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Agent' });
    expect(screen.queryByRole('button', { name: /^Limit: / })).toBeNull();
  });

  it('words the chip help from the Run defaults, with a kind and without one', async () => {
    renderField({ sessionId: SESSION.id });
    fireEvent.click(await screen.findByRole('button', { name: RUN_DEFAULT }));
    screen.getByText(/Run defaults set where new runs start\./);
    expect(screen.queryByText(/Other runs in this workspace/)).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    pickKind({ name: 'Orchestrated' });
    fireEvent.click(await screen.findByRole('button', { name: RUN_DEFAULT }));

    screen.getByText(/Run defaults set where new runs start\./);
  });

  it('opens the Run defaults page from the Change default link of the chip', async () => {
    const details: Array<unknown> = [];
    const opened = (event: Event): void => {
      details.push(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener('goodboy:open-settings', opened);
    renderField({ sessionId: SESSION.id });
    fireEvent.click(await screen.findByRole('button', { name: RUN_DEFAULT }));

    fireEvent.click(screen.getByRole('button', { name: 'Change default' }));

    window.removeEventListener('goodboy:open-settings', opened);
    expect(details).toEqual([{ scope: 'workspace', section: 'general' }]);
  });

  it('starts a no-kind ask from the Run defaults limit even when the route is a plan', async () => {
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: RUN_DEFAULT });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'default' });
  });

  it('keeps a typed amount across kinds and starts a workflow with it for this run only', async () => {
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit: $3.00' });
    pickKind({ name: 'Auto' });
    screen.getByRole('button', { name: 'Limit: $3.00' });
    pickKind({ name: 'Orchestrated' });

    ask({ text: QUESTION });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 3, limitSource: 'run' });
    expect(storedRunLimit()).toBe(8);
    await screen.findByRole('button', { name: RUN_DEFAULT });
  });

  it('forgets a typed amount once the run started, so the next start uses the default again', async () => {
    const attach = startOrchestrated();
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit: $3.00' });
    ask({ text: QUESTION });
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(field()).toHaveProperty('value', ''));

    pickKind({ name: 'Orchestrated' });
    await screen.findByRole('button', { name: RUN_DEFAULT });
    ask({ text: QUESTION });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(attach.mock.calls[1]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'default' });
  });

  it('keeps a typed amount when the start fails, so Retry sends it again', async () => {
    const attach = startOrchestrated();
    attach.mockRejectedValueOnce(new Error('session worktree not available'));
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Orchestrated' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit: $3.00' });
    ask({ text: QUESTION });
    await screen.findByText(/session worktree not available/);
    screen.getByRole('button', { name: 'Limit: $3.00' });

    fireEvent.click(screen.getByRole('button', { name: /^Retry/ }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(attach.mock.calls[1]?.[2]).toMatchObject({ spendLimitUsd: 3, limitSource: 'run' });
  });

  it('never writes an amount typed on an Auto run into the Run defaults', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Auto' });
    await typeLimit({ from: RUN_DEFAULT, usd: '9', shown: 'Limit: $9.00' });

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(storedRunLimit()).toBe(8);
  });
});
