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
type AttachFn = StoryState['attachWorkflowToSession'];

const field = () => screen.getByRole('textbox', { name: 'Start a run' });

type KindParams = {
  readonly name: string;
};

const PLAN_CHOICES: Readonly<Record<string, string>> = {
  Lead: 'The Lead plans it',
  Agent: 'One agent',
};

const pickKind = ({ name }: KindParams): void => {
  if (name === 'Preset') {
    fireEvent.click(screen.getByRole('combobox', { name: 'Workflow' }));
    fireEvent.click(screen.getByRole('option', { name: /^Fix a layout/ }));
    return;
  }
  const pill = screen.queryByRole('combobox', { name: 'Workflow' });
  if (name === 'Lead' && pill?.textContent?.includes('Auto') === false) {
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('option', { name: /^Auto/ }));
    return;
  }
  fireEvent.click(
    within(screen.getByRole('tablist', { name: 'Plan' })).getByRole('tab', {
      name: PLAN_CHOICES[name] ?? name,
    }),
  );
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
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: {},
  });
});

afterEach(cleanup);

const startLead = () => {
  const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
  const attachWorkflowToSession = vi.fn<AttachFn>(async () => undefined);
  useAppStore.setState({ spawnAgent, attachWorkflowToSession });
  return { spawnAgent, attachWorkflowToSession };
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
  it('starts a task with an end as a Lead under the default amount the chip showed', async () => {
    storeDefaultLimit({ usd: 5 });
    const engines = startLead();
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: 'Limit: $5.00 · default' });

    ask({ text: 'center every member page' });

    await waitFor(() => expect(engines.spawnAgent).toHaveBeenCalledTimes(1));
    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(storedRunLimit()).toBe(5);
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

  it('starts Preset as a Lead under the Run defaults limit', async () => {
    const engines = startLead();
    renderField({ sessionId: SESSION.id });

    pickKind({ name: 'Preset' });
    await screen.findByRole('button', { name: RUN_DEFAULT });
    ask({ text: QUESTION });

    await waitFor(() => expect(engines.spawnAgent).toHaveBeenCalledTimes(1));
    expect(engines.spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    expect(engines.attachWorkflowToSession).not.toHaveBeenCalled();
  });

  it('shows the Run defaults limit on every kind, and no chip on Agent', async () => {
    renderField({ sessionId: SESSION.id });
    await screen.findByRole('button', { name: RUN_DEFAULT });

    pickKind({ name: 'Lead' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Preset' });
    screen.getByRole('button', { name: RUN_DEFAULT });
    pickKind({ name: 'Agent' });
    expect(screen.queryByRole('button', { name: /^Limit: / })).toBeNull();
  });

  it('words the chip help from Runs in Settings, with a kind and without one', async () => {
    renderField({ sessionId: SESSION.id });
    fireEvent.click(await screen.findByRole('button', { name: RUN_DEFAULT }));
    screen.getByText(/Runs in Settings sets where new runs start\./);
    expect(screen.queryByText(/Other runs in this workspace/)).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    pickKind({ name: 'Preset' });
    fireEvent.click(await screen.findByRole('button', { name: RUN_DEFAULT }));

    screen.getByText(/Runs in Settings sets where new runs start\./);
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

  it('keeps a typed amount across kinds and leaves the Run defaults alone', async () => {
    const engines = startLead();
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Preset' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit: $3.00' });
    pickKind({ name: 'Lead' });
    screen.getByRole('button', { name: 'Limit: $3.00' });

    ask({ text: QUESTION });

    await waitFor(() => expect(engines.spawnAgent).toHaveBeenCalledTimes(1));
    expect(storedRunLimit()).toBe(8);
    await screen.findByRole('button', { name: RUN_DEFAULT });
  });

  it('keeps a typed amount when the start fails, so Retry starts with it again', async () => {
    const engines = startLead();
    engines.spawnAgent.mockRejectedValueOnce(new Error('session worktree not available'));
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Preset' });
    await typeLimit({ from: RUN_DEFAULT, usd: '3', shown: 'Limit: $3.00' });
    ask({ text: QUESTION });
    await screen.findByText(/session worktree not available/);
    screen.getByRole('button', { name: 'Limit: $3.00' });

    fireEvent.click(screen.getByRole('button', { name: /^Retry/ }));

    await waitFor(() => expect(engines.spawnAgent).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: RUN_DEFAULT });
  });

  it('never writes an amount typed on a Lead run into the Run defaults', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField({ sessionId: SESSION.id });
    pickKind({ name: 'Lead' });
    await typeLimit({ from: RUN_DEFAULT, usd: '9', shown: 'Limit: $9.00' });

    ask({ text: QUESTION });

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(storedRunLimit()).toBe(8);
  });
});
