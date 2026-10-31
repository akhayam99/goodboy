// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import type {
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
} from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import type { ProviderDisplayInfo } from '../../../providers/providers';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { AppStore } from '../../../../store/store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import { SessionDraftPane } from '.';

let useAppStore: StoryStore;
let cameFrom: Session;

const STAMP = brandedId<IsoDateTime>({ value: '2026-10-14T09:00:00.000Z' });
const WORKSPACE_GUIDANCE = 'Keep every change inside payments-api.';
const RUN_GUIDANCE = 'Skip the ledger-core migration.';
const GOAL = 'Stop retried webhooks posting a second credit in payments-api';
const PRESET_ID = brandedId<WorkflowId>({ value: 'wf-new-session-preset' });

const PRESET: Workflow = {
  id: PRESET_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Scout, plan, build',
  description: 'Read the code, plan the change, then build it.',
  steps: [
    {
      id: brandedId<StepId>({ value: 'step-new-session-scout' }),
      workflowId: PRESET_ID,
      ordinal: 0,
      name: 'Scout the retry path',
      role: 'scout',
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: STAMP,
  updatedAt: STAMP,
};

const attach = vi.fn<AppStore['attachWorkflowToSession']>();
const save = vi.fn<AppStore['savePhaseTemplate']>();
const createSession = vi.fn<AppStore['createSession']>();
const spawnAgent = vi.fn<AppStore['spawnAgent']>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  const first = useAppStore.getState().sessions[0];
  if (first === undefined) {
    throw new Error('the board seed has no session');
  }
  cameFrom = first;
  attach.mockReset();
  attach.mockResolvedValue(undefined);
  save.mockReset();
  save.mockImplementation(async (args): Promise<Workflow> => ({
    id: args.id ?? brandedId<WorkflowId>({ value: 'wf-saved' }),
    workspaceId: WORKSPACE_ID,
    name: args.name,
    description: '',
    steps: [],
    createdAt: STAMP,
    updatedAt: STAMP,
  }));
  createSession.mockReset();
  createSession.mockImplementation(async () => ({ session: cameFrom }));
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  useAppStore.setState({
    phaseTemplates: { [WORKSPACE_ID]: [PRESET] },
    workspaceValues: { [WORKSPACE_ID]: { 'auto.treeLimitUsd': '5' } },
    attachWorkflowToSession: attach,
    savePhaseTemplate: save,
    createSession,
    spawnAgent,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const openPage = async (): Promise<void> => {
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: cameFrom.id }) });
  useAppStore.getState().openSessionDraft();
  render(
    <ToastProvider>
      <SessionDraftPane workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  await settle();
};

const textBox = (name: string): HTMLTextAreaElement => {
  const element = screen.getByRole('textbox', { name });
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('Expected a text area');
  }
  return element;
};

const startButton = (): HTMLButtonElement => {
  const element = screen.getByRole('button', { name: 'Start' });
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Expected a button');
  }
  return element;
};

type ConnectParams = {
  readonly id: ProviderDisplayInfo['id'];
};

const providerOf = ({ id }: ConnectParams): ProviderDisplayInfo => ({
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

const noSetting: AppStore['loadSetting'] = async () => null;

const startThenRun: AppStore['startSessionFromDraft'] = async ({ start }) => {
  if (start.kind === 'workflow-run') {
    await start.run(cameFrom);
  }
  if (start.kind === 'task' && start.then?.kind === 'workflow-run') {
    await start.then.run(cameFrom);
  }
  return cameFrom;
};

const TASK: IssueCandidate = {
  provider: 'linear',
  externalId: 'nw-88',
  identifier: 'NW-88',
  title: 'Retried webhooks post a second credit',
  url: 'https://linear.app/northwind/issue/NW-88',
  goal: 'Stop retried webhooks posting a second credit in payments-api',
  body: '',
  branchSlug: 'retried-webhooks-post-a-second-credit',
};

const typeGoal = (text: string): void => {
  fireEvent.change(textBox('Goal'), { target: { value: text } });
};

type ChooseParams = {
  readonly box: string;
  readonly option: RegExp;
};

const chooseOption = async ({ box, option }: ChooseParams): Promise<void> => {
  fireEvent.click(screen.getByRole('combobox', { name: box }));
  await settle();
  fireEvent.click(screen.getByRole('option', { name: option }));
  await settle();
};

const renderPage = async (): Promise<void> => {
  render(
    <ToastProvider>
      <SessionDraftPane workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  await settle();
};

const KINDS = 'What kind of run?';

type KindParams = {
  readonly name: RegExp;
};

const kindTab = ({ name }: KindParams): HTMLElement =>
  within(screen.getByRole('tablist', { name: KINDS })).getByRole('tab', { name });

const pickKind = async ({ name }: KindParams): Promise<void> => {
  fireEvent.click(kindTab({ name }));
  await settle();
};

const isPicked = ({ name }: KindParams): boolean =>
  kindTab({ name }).getAttribute('aria-selected') === 'true';

describe('New session page', () => {
  it('opens on the task first, with Tasks in its bottom row and Where in the settings row', async () => {
    await openPage();

    const task = within(screen.getByRole('region', { name: 'Goal' }));
    expect(textBox('Goal').placeholder).toBe('Describe the goal, or pick one from Tasks');
    task.getByRole('combobox', { name: 'Pick from Tasks' });
    expect(task.queryByRole('combobox', { name: 'Where' })).toBeNull();
    const settings = within(screen.getByRole('group', { name: 'Run settings' }));
    expect(settings.getByRole('combobox', { name: 'Where' }).textContent).toContain('Auto picks');
    expect(screen.queryByRole('region', { name: 'Folders' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start workflow' })).toBeNull();
    expect(startButton().disabled).toBe(true);
    screen.getByText('Write the goal first.');
  });

  it('shows four kinds on one row, none picked, and says Auto picks until one is', async () => {
    await openPage();

    const kinds = within(screen.getByRole('tablist', { name: KINDS }));
    expect(kinds.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Auto',
      'Agent',
      'Orchestrated',
      'Preset',
    ]);
    expect(kinds.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    screen.getByText('Auto picks how to run it. Or pick a kind.');
  });

  it('says what the picked kind does, and gives the choice back to Auto on a second press', async () => {
    await openPage();

    await pickKind({ name: /^Orchestrated/ });

    expect(isPicked({ name: /^Orchestrated/ })).toBe(true);
    screen.getByText('Auto plans each next step as it goes.');
    await pickKind({ name: /^Orchestrated/ });
    expect(isPicked({ name: /^Orchestrated/ })).toBe(false);
    screen.getByText('Auto picks how to run it. Or pick a kind.');
  });

  it('keeps the goal and the values that still apply when you switch kind', async () => {
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    fireEvent.click(screen.getByRole('button', { name: /^Asks you: Every step/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { workflowGoal: GOAL },
    });

    await pickKind({ name: /^Preset/ });
    await pickKind({ name: /^Agent/ });
    await pickKind({ name: /^Orchestrated/ });

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal).toBe(GOAL);
    expect(textBox('Goal').value).toBe(GOAL);
    screen.getByRole('button', { name: 'Asks you: Never, this run' });
  });

  it('keeps the Limit chip under Auto picks, and drops it once the route is an agent', async () => {
    await openPage();

    screen.getByRole('button', { name: /^Limit \$5\.00/ });

    typeGoal('@Scout list every page that uses the old layout');
    await settle();

    expect(screen.queryByRole('button', { name: /^Limit / })).toBeNull();
  });

  it('pins folders from Where, and clearing them gives the choice back to Auto', async () => {
    await openPage();

    await chooseOption({ box: 'Where', option: /payments-api/ });
    const where = screen.getByRole('combobox', { name: 'Where' });
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.projectIds).toHaveLength(1);
    expect(where.textContent).not.toContain('Auto picks');

    act(() =>
      useAppStore.getState().patchSessionDraft({
        workspaceId: WORKSPACE_ID,
        patch: { projectIds: [] },
      }),
    );
    await settle();
    expect(screen.getByRole('combobox', { name: 'Where' }).textContent).toContain('Auto picks');
  });

  it('opens on the kind you started last in this workspace', async () => {
    const loadSetting: AppStore['loadSetting'] = async (key) =>
      key === `newSession.lastStart.${WORKSPACE_ID}` ? 'preset' : null;
    useAppStore.setState({ loadSetting });

    await openPage();

    expect(isPicked({ name: /^Preset/ })).toBe(true);
  });

  it('keeps the pick of this window when another window starts something else', async () => {
    let last: string | null = null;
    const loadSetting: AppStore['loadSetting'] = async () => last;
    useAppStore.setState({ loadSetting });
    await openPage();
    await pickKind({ name: /^Agent/ });

    last = 'preset';
    cleanup();
    render(
      <ToastProvider>
        <SessionDraftPane workspaceId={WORKSPACE_ID} />
      </ToastProvider>,
    );
    await settle();

    expect(isPicked({ name: /^Agent/ })).toBe(true);
    expect(isPicked({ name: /^Preset/ })).toBe(false);
  });

  it('keeps Start blank in the header and Discard in the actions row once something is written', async () => {
    await openPage();

    screen.getByRole('button', { name: /start blank/i });
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });

    expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
  });

  it('creates the session and starts one agent with the ask Auto could not place', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();

    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });
    fireEvent.click(startButton());

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({ kindOverride: 'auto', initialPrompt: GOAL }),
    );
    expect(attach).not.toHaveBeenCalled();
  });

  it('starts a plan from the preset named with ~ after creating the session', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();

    fireEvent.change(textBox('Goal'), { target: { value: `~Scout, plan, build ${GOAL}` } });
    fireEvent.click(startButton());

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[0]).toBe(cameFrom.id);
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      rulesSnapshot: { route: { row: 1, presetName: 'Scout, plan, build', closeness: 'follow' } },
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('starts an orchestrated workflow with the route you picked', async () => {
    const saveSetting = vi.fn<AppStore['saveSetting']>(async () => undefined);
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      saveSetting,
    });
    await openPage();
    await pickKind({ name: /^Orchestrated/ });

    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      goal: GOAL,
      rulesSnapshot: { route: { shape: 'plan', presetName: null, why: 'you picked it' } },
    });
    expect(spawnAgent).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(saveSetting).toHaveBeenCalledWith(
        `newSession.lastStart.${WORKSPACE_ID}`,
        'orchestrated',
      ),
    );
  });

  it('shows Asks you on every kind but a plain agent, named like the run page', async () => {
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    screen.getByRole('button', { name: /^Asks you: Every step, / });

    await pickKind({ name: /^Preset/ });
    screen.getByRole('button', { name: /^Asks you: Every step, / });

    await pickKind({ name: /^Auto/ });
    screen.getByRole('button', { name: /^Asks you: / });

    await pickKind({ name: /^Agent/ });
    expect(screen.queryByRole('button', { name: /^Asks you/ })).toBeNull();
  });

  it('starts a workflow that asks at every step when Asks you is left alone', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      autoRun: false,
      rulesSnapshot: { autonomy: 'step' },
    });
  });

  it('starts the workflow with the Asks you you picked', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    fireEvent.click(screen.getByRole('button', { name: /^Asks you: Every step/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    screen.getByRole('button', { name: 'Asks you: Never, this run' });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      autoRun: true,
      rulesSnapshot: { autonomy: 'run' },
    });
  });

  it('starts the preset you picked and follows it when you say so', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();
    await pickKind({ name: /^Preset/ });
    typeGoal(GOAL);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start workflow' }).disabled).toBe(
      true,
    );
    screen.getByText('Pick a preset first.');
    await chooseOption({ box: 'Preset', option: /Scout, plan, build/ });
    const steps = screen.getByRole('list', { name: 'Preset steps' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Follow it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      rulesSnapshot: {
        route: { presetName: 'Scout, plan, build', closeness: 'follow', why: 'you picked it' },
        preset: { name: 'Scout, plan, build' },
      },
    });
  });

  it('starts the role you picked on the model you picked', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Agent/ });

    expect(screen.queryByRole('button', { name: /^Limit/ })).toBeNull();
    await chooseOption({ box: 'Role', option: /^Planner/ });
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { agentRouting: { provider: 'anthropic', model: 'opus', effort: 'high' } },
    });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Planner' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({
        kindOverride: 'planner',
        initialPrompt: GOAL,
        provider: 'anthropic',
        model: 'opus',
        effort: 'high',
      }),
    );
    expect(attach).not.toHaveBeenCalled();
  });

  it('picks the Agent model from the same Model chip as every other kind', async () => {
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      providers: [providerOf({ id: 'anthropic' }), providerOf({ id: 'cursor' })],
    });
    await openPage();
    await pickKind({ name: /^Agent/ });
    await chooseOption({ box: 'Role', option: /^Planner/ });
    const chip = screen.getByRole('button', { name: /^Model:/ });
    expect(chip.getAttribute('data-run-model')).toBe('auto');
    expect(chip.getAttribute('aria-label')).toMatch(/, Auto$/);

    fireEvent.click(chip);
    await settle();
    screen.getByRole('button', { name: 'Change the default in Settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    await settle();

    const picked = useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.agentRouting;
    expect(picked).toMatchObject({ provider: 'cursor' });
    expect(screen.getByRole('button', { name: /^Model:/ }).getAttribute('data-run-model')).toBe(
      'pinned',
    );
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Planner' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({ provider: 'cursor' }),
    );
  });

  it('starts Auto agent with the goal', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Auto/ });

    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({ kindOverride: 'auto', initialPrompt: GOAL }),
    );
  });

  it('keeps the goal and offers Retry when the start fails, and Retry starts it', async () => {
    const failOnce = vi.fn<AppStore['startSessionFromDraft']>();
    failOnce.mockRejectedValueOnce(new Error('The folder is locked by another window'));
    failOnce.mockImplementation(startThenRun);
    useAppStore.setState({
      startSessionFromDraft: failOnce,
      loadSetting: noSetting,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    expect(await screen.findByText('The folder is locked by another window')).toBeDefined();
    expect(textBox('Goal').value).toBe(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
  });

  it('drops a late answer once you left the page', async () => {
    const late: { fail: (error: Error) => void } = { fail: () => undefined };
    const pending: AppStore['startSessionFromDraft'] = () =>
      new Promise((_resolve, reject) => {
        late.fail = reject;
      });
    useAppStore.setState({ startSessionFromDraft: pending, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Auto/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));
    await settle();

    cleanup();
    late.fail(new Error('Late failure'));
    await settle();
    await renderPage();

    expect(screen.queryByText('Late failure')).toBeNull();
    screen.getByRole('button', { name: 'Start Auto agent' });
  });

  it('attaches a task on any kind, starts on it, and Remove takes it off', async () => {
    const start = vi.fn<AppStore['startSessionFromDraft']>(startThenRun);
    useAppStore.setState({ startSessionFromDraft: start, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Auto/ });
    screen.getByRole('combobox', { name: 'Pick from Tasks' });

    act(() =>
      useAppStore.getState().patchSessionDraft({
        workspaceId: WORKSPACE_ID,
        patch: { pickedIssues: [TASK], workflowGoal: TASK.goal },
      }),
    );
    await settle();
    expect(screen.queryByRole('combobox', { name: 'Pick from Tasks' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]?.[0].start).toMatchObject({
      kind: 'task',
      candidates: [TASK],
      goal: TASK.goal,
    });
    cleanup();

    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { pickedIssues: [TASK], startKind: 'workflow', startShape: 'orchestrated' },
    });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Remove NW-88' }));
    await settle();
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.pickedIssues).toEqual([]);
    screen.getByRole('combobox', { name: 'Pick from Tasks' });
  });

  it('asks on Esc with a goal in the form, and Discard clears the draft', async () => {
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    typeGoal(GOAL);

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();
    screen.getByText('Keep this draft?');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await settle();
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });
});

const withRunDefault = (): void => {
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE_ID]: {
        ...EMPTY_OVERRIDES,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: 8 },
      },
    },
    generateWorkflowTitle: vi.fn(async () => undefined),
    startSessionFromDraft: startThenRun,
    loadSetting: noSetting,
  });
};

describe('New session limit by kind', () => {
  const AUTO_DEFAULT = /^Limit \$5\.00 · default$/;
  const RUN_DEFAULT = /^Limit \$8\.00 · default$/;

  type TypeLimitParams = {
    readonly usd: string;
  };

  const typeLimit = async ({ usd }: TypeLimitParams): Promise<void> => {
    fireEvent.click(screen.getByRole('button', { name: /^Limit / }));
    await settle();
    fireEvent.change(screen.getByRole('textbox', { name: 'Other amount' }), {
      target: { value: usd },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this limit' }));
    await settle();
  };

  it('starts every kind from its own default, and Agent has no limit', async () => {
    withRunDefault();
    await openPage();

    screen.getByRole('button', { name: AUTO_DEFAULT });
    await pickKind({ name: /^Orchestrated/ });
    screen.getByRole('button', { name: RUN_DEFAULT });
    await pickKind({ name: /^Preset/ });
    screen.getByRole('button', { name: RUN_DEFAULT });
    await pickKind({ name: /^Auto/ });
    screen.getByRole('button', { name: AUTO_DEFAULT });
    await pickKind({ name: /^Agent/ });
    expect(screen.queryByRole('button', { name: /^Limit / })).toBeNull();
  });

  it('starts an Orchestrated run from the Run defaults limit', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'default' });
  });

  it('starts a Preset run from the Run defaults limit', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Preset/ });
    typeGoal(GOAL);
    await chooseOption({ box: 'Preset', option: /Scout, plan, build/ });

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 8, limitSource: 'default' });
  });

  it('starts a workflow with a typed amount for this run and leaves the Auto limit alone', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    await typeLimit({ usd: '3' });
    screen.getByRole('button', { name: 'Limit $3.00' });
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 3, limitSource: 'run' });
    expect(useAppStore.getState().workspaceValues[WORKSPACE_ID]?.['auto.treeLimitUsd']).toBe('5');
  });

  it('keeps a typed amount when the kind changes', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    await typeLimit({ usd: '3' });

    await pickKind({ name: /^Auto/ });

    screen.getByRole('button', { name: 'Limit $3.00' });
  });
});

describe('New session settings row', () => {
  beforeEach(withRunDefault);

  const chipNames = (): ReadonlyArray<string> =>
    within(screen.getByRole('group', { name: 'Run settings' }))
      .getAllByRole('button')
      .map((button) => button.getAttribute('data-setting-chip') ?? button.textContent ?? '');

  it('lists the settings a kind uses in one row and hides what it cannot use', async () => {
    await openPage();

    await pickKind({ name: /^Orchestrated/ });
    expect(chipNames()).toEqual(
      expect.arrayContaining(['Asks you', 'Edits', expect.stringMatching(/^Limit/)]),
    );
    await pickKind({ name: /^Agent/ });
    expect(chipNames()).toEqual(expect.arrayContaining(['Edits']));
    expect(chipNames().some((name) => name.startsWith('Limit') || name === 'Asks you')).toBe(false);
    screen.getByRole('combobox', { name: 'Role' });
  });

  it('opens a popover from every chip of the row', async () => {
    await openPage();
    await pickKind({ name: /^Orchestrated/ });

    const row = within(screen.getByRole('group', { name: 'Run settings' }));
    const chips: ReadonlyArray<RegExp> = [
      /^Model:/,
      /^Asks you:/,
      /^Edits:/,
      /^Limit /,
      /^Guidance:/,
    ];
    for (const name of chips) {
      fireEvent.click(row.getByRole('button', { name }));
      await settle();
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      await settle();
    }
  });

  it('starts with the Edits you picked', async () => {
    const setMode = vi.fn<AppStore['setSessionPermissionMode']>(async () => undefined);
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      setSessionPermissionMode: setMode,
    });
    await openPage();
    await pickKind({ name: /^Auto/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: /^Edits:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: /^Read only/ }));
    await settle();
    screen.getByRole('button', { name: /^Edits: Read only, this session/ });
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(setMode).toHaveBeenCalledWith(cameFrom.id, 'plan');
  });

  it('writes no Edits when the person picked none', async () => {
    const setMode = vi.fn<AppStore['setSessionPermissionMode']>(async () => undefined);
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      setSessionPermissionMode: setMode,
    });
    await openPage();
    await pickKind({ name: /^Auto/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(setMode).not.toHaveBeenCalled();
  });

  it('starts the Auto agent on the Asks you level picked for it', async () => {
    const changeAutoLevel = vi.fn<AppStore['changeAutoLevel']>(async () => undefined);
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      changeAutoLevel,
    });
    await openPage();
    await pickKind({ name: /^Auto/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: /^Asks you:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(changeAutoLevel).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: cameFrom.id, level: 'run' }),
    );
  });
});

describe('New session guidance', () => {
  const withWorkspaceGuidance = (): void => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, standingGuidance: WORKSPACE_GUIDANCE },
        },
      },
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      generateWorkflowTitle: vi.fn(async () => undefined),
    });
  };

  const guidanceChip = (): HTMLElement =>
    within(screen.getByRole('group', { name: 'Run settings' })).getByRole('button', {
      name: /^Guidance:/,
    });

  const editGuidance = async (text: string): Promise<void> => {
    fireEvent.click(guidanceChip());
    await settle();
    const popover = screen.getByRole('dialog', { name: 'Guidance for this run' });
    fireEvent.change(within(popover).getByRole('textbox', { name: 'Guidance text' }), {
      target: { value: text },
    });
    await settle();
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();
  };

  const kickoffOf = (): string => {
    const prompt = spawnAgent.mock.calls[0]?.[1].initialPrompt;
    return prompt ?? '';
  };

  it('shows the workspace guidance on every kind with its tag', async () => {
    withWorkspaceGuidance();
    await openPage();

    for (const name of [/^Auto/, /^Agent/, /^Orchestrated/, /^Preset/]) {
      await pickKind({ name });
      expect(guidanceChip().getAttribute('aria-label')).toBe(
        `Guidance: ${WORKSPACE_GUIDANCE}, from Harborline`,
      );
    }
  });

  it('says who reads it for the kind you pressed', async () => {
    withWorkspaceGuidance();
    await openPage();
    const readers: ReadonlyArray<readonly [RegExp, string]> = [
      [/^Auto/, 'Read by the Auto agent and the helpers it starts.'],
      [/^Agent/, 'Read by the agent at the start of its brief.'],
      [/^Orchestrated/, 'Read by the orchestrator, which carries it into each step.'],
    ];
    for (const [name, line] of readers) {
      await pickKind({ name });
      fireEvent.click(guidanceChip());
      await settle();
      within(screen.getByRole('dialog', { name: 'Guidance for this run' })).getByText(line);
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      await settle();
    }
  });

  it('hands the guidance you wrote to the agent kickoff', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Agent/ });
    await editGuidance(RUN_GUIDANCE);
    expect(guidanceChip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: RUN_GUIDANCE });
    expect(kickoffOf()).toBe(GOAL);
  });

  it('hands the workspace guidance to the Auto agent when you leave it alone', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Auto/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      guidance: WORKSPACE_GUIDANCE,
    });
  });

  it('snapshots the guidance you wrote in the rules of an orchestrated run', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    await editGuidance(RUN_GUIDANCE);
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: RUN_GUIDANCE,
    });
  });

  it('sends an empty guidance when you press No guidance', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Preset/ });
    await chooseOption({ box: 'Preset', option: /Scout, plan, build/ });
    fireEvent.click(guidanceChip());
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'No guidance' }));
    await settle();
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();
    expect(guidanceChip().getAttribute('aria-label')).toBe('Guidance: None, this run');
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({ standingGuidance: '' });
  });

  it('puts the workspace guidance back with Use workspace guidance', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Auto/ });
    await editGuidance(RUN_GUIDANCE);
    fireEvent.click(guidanceChip());
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Use workspace guidance' }));
    await settle();

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.guidance).toBeNull();
    expect(guidanceChip().getAttribute('aria-label')).toBe(
      `Guidance: ${WORKSPACE_GUIDANCE}, from Harborline`,
    );
  });

  it('keeps the guidance you wrote when you switch kind', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    await editGuidance(RUN_GUIDANCE);

    await pickKind({ name: /^Agent/ });
    await pickKind({ name: /^Preset/ });
    await pickKind({ name: /^Auto/ });

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.guidance).toBe(RUN_GUIDANCE);
    expect(guidanceChip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
  });

  it('keeps the guidance when the start fails, and Retry sends it again', async () => {
    withWorkspaceGuidance();
    const failOnce = vi.fn<AppStore['startSessionFromDraft']>();
    failOnce.mockRejectedValueOnce(new Error('The folder is locked by another window'));
    failOnce.mockImplementation(startThenRun);
    useAppStore.setState({ startSessionFromDraft: failOnce });
    await openPage();
    await pickKind({ name: /^Orchestrated/ });
    await editGuidance(RUN_GUIDANCE);
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    expect(await screen.findByText('The folder is locked by another window')).toBeDefined();
    expect(guidanceChip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[2]?.rulesSnapshot).toMatchObject({
      standingGuidance: RUN_GUIDANCE,
    });
  });
});
