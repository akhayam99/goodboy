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
const FITTING_GOAL = 'Scout the retry path in payments-api, then build the fix';
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

const openMore = (): void => {
  const change = screen.queryByRole('button', { name: 'Change' });
  if (change !== null) {
    fireEvent.click(change);
  }
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
  openMore();
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
  openMore();
};

const PLAN = 'Plan';

const LEAD_LINE = 'The Lead writes a plan first, then starts the agents it needs.';

const PLAN_CHOICES: Readonly<Record<string, string>> = {
  '^Lead': 'The Lead plans it',
  '^Agent': 'One agent',
};

type KindParams = {
  readonly name: RegExp;
};

const planTab = ({ name }: KindParams): HTMLElement =>
  within(screen.getByRole('tablist', { name: PLAN })).getByRole('tab', {
    name: PLAN_CHOICES[name.source] ?? name,
  });

const workflowPill = (): HTMLElement | null => screen.queryByRole('combobox', { name: 'Workflow' });

const isAuto = (): boolean => workflowPill()?.textContent?.includes('Auto') === true;

const pickKind = async ({ name }: KindParams): Promise<void> => {
  if (name.source === '^Preset') {
    if (workflowPill() === null) {
      fireEvent.click(planTab({ name: /^Lead/ }));
      await settle();
    }
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    return;
  }
  if (name.source === '^Lead' && workflowPill() !== null && !isAuto()) {
    await chooseOption({ box: 'Workflow', option: /^Auto/ });
    return;
  }
  fireEvent.click(planTab({ name }));
  await settle();
};

const isPicked = ({ name }: KindParams): boolean => {
  if (name.source === '^Agent') {
    return planTab({ name }).getAttribute('aria-selected') === 'true';
  }
  const isLead = planTab({ name: /^Lead/ }).getAttribute('aria-selected') === 'true';
  return isLead && isAuto() === (name.source === '^Lead');
};

describe('New session page', () => {
  it('opens on the task first, with Tasks in its bottom row and Where in the settings row', async () => {
    await openPage();

    const task = within(screen.getByRole('region', { name: 'Goal' }));
    expect(textBox('Goal').placeholder).toBe('Describe the goal, or pick one from Tasks');
    task.getByRole('combobox', { name: 'Pick from Tasks' });
    expect(task.queryByRole('combobox', { name: 'Projects' })).toBeNull();
    const settings = within(screen.getByRole('group', { name: 'Run settings' }));
    expect(settings.getByRole('combobox', { name: 'Projects' }).textContent).toContain(
      'Auto picks',
    );
    expect(screen.queryByRole('region', { name: 'Folders' })).toBeNull();
    expect(startButton().textContent).toBe('Start');
    expect(startButton().disabled).toBe(true);
    screen.getByText('Write the goal first.');
  });

  it('shows a Plan row of two kinds and a Workflow pill, the Lead on Auto, and says what the Lead does', async () => {
    await openPage();

    const kinds = within(screen.getByRole('tablist', { name: PLAN }));
    expect(kinds.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'The Lead plans it',
      'One agent',
    ]);
    expect(workflowPill()?.textContent).toBe('WorkflowAuto');
    expect(kinds.queryByRole('tab', { name: /^Orchestrated/ })).toBeNull();
    expect(kinds.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
    ]);
    screen.getByText(LEAD_LINE);
    expect(screen.queryByRole('button', { name: /^How: / })).toBeNull();
  });

  it('keeps the button reading Start whatever the kind', async () => {
    await openPage();

    expect(startButton().textContent).toBe('Start');
    await pickKind({ name: /^Preset/ });
    expect(startButton().textContent).toBe('Start');
    await pickKind({ name: /^Agent/ });
    expect(startButton().textContent).toBe('Start');
    await pickKind({ name: /^Lead/ });
    expect(startButton().textContent).toBe('Start');
    expect(isPicked({ name: /^Lead/ })).toBe(true);
  });

  it('says what the picked workflow does, and gives the plan back to the Lead', async () => {
    await openPage();

    await pickKind({ name: /^Preset/ });

    expect(isPicked({ name: /^Preset/ })).toBe(true);
    screen.getByRole('combobox', { name: 'Workflow' });
    screen.getByRole('checkbox', { name: 'Keep its steps as written' });
    await pickKind({ name: /^Preset/ });
    expect(isPicked({ name: /^Preset/ })).toBe(true);
    await pickKind({ name: /^Lead/ });
    expect(isPicked({ name: /^Preset/ })).toBe(false);
    screen.getByText(LEAD_LINE);
  });

  it('keeps the goal and the values that still apply when you switch kind', async () => {
    await openPage();
    await pickKind({ name: /^Preset/ });
    fireEvent.click(screen.getByRole('button', { name: /^Stops:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { workflowGoal: GOAL },
    });

    await pickKind({ name: /^Agent/ });
    await pickKind({ name: /^Preset/ });

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal).toBe(GOAL);
    expect(textBox('Goal').value).toBe(GOAL);
    screen.getByRole('button', { name: /^Stops: Never/ });
  });

  it('keeps the Limit chip under Auto picks, and drops it once the route is an agent', async () => {
    await openPage();

    screen.getByRole('button', { name: 'Limit: none' });

    typeGoal('@Scout list every page that uses the old layout');
    await settle();

    expect(screen.queryByRole('button', { name: /^Limit: / })).toBeNull();
  });

  it('pins folders from Where, and clearing them gives the choice back to Auto', async () => {
    await openPage();

    await chooseOption({ box: 'Projects', option: /payments-api/ });
    const where = screen.getByRole('combobox', { name: 'Projects' });
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.projectIds).toHaveLength(1);
    expect(where.textContent).not.toContain('Auto picks');

    act(() =>
      useAppStore.getState().patchSessionDraft({
        workspaceId: WORKSPACE_ID,
        patch: { projectIds: [] },
      }),
    );
    await settle();
    expect(screen.getByRole('combobox', { name: 'Projects' }).textContent).toContain('Auto picks');
  });

  it('opens on the kind you started last in this workspace', async () => {
    const loadSetting: AppStore['loadSetting'] = async (key) =>
      key === `newSession.lastStart.${WORKSPACE_ID}` ? 'agent' : null;
    useAppStore.setState({ loadSetting });

    await openPage();

    expect(isPicked({ name: /^Agent/ })).toBe(true);
  });

  it('opens a remembered workflow start on Auto, since a workflow is not remembered', async () => {
    const loadSetting: AppStore['loadSetting'] = async (key) =>
      key === `newSession.lastStart.${WORKSPACE_ID}` ? 'preset' : null;
    useAppStore.setState({ loadSetting });

    await openPage();

    expect(isPicked({ name: /^Lead/ })).toBe(true);
    expect(workflowPill()?.textContent).toBe('WorkflowAuto');
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

  it('starts a Lead with the preset named with ~ as its plan after creating the session', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();

    fireEvent.change(textBox('Goal'), { target: { value: `~Scout, plan, build ${GOAL}` } });
    fireEvent.click(startButton());

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[0]).toBe(cameFrom.id);
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(GOAL);
    expect(attach).not.toHaveBeenCalled();
  });

  it('starts an older Orchestrated pick as a Lead', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { startKind: 'workflow', startShape: 'orchestrated', hasChosenStart: true },
    });
    await openPage();
    expect(isPicked({ name: /^Lead/ })).toBe(true);

    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({ kindOverride: 'auto', initialPrompt: GOAL }),
    );
    expect(attach).not.toHaveBeenCalled();
  });

  it('shows Stops on every kind but a plain agent, named like the run page', async () => {
    await openPage();
    await pickKind({ name: /^Preset/ });
    screen.getByRole('button', { name: /^Stops: / });

    await pickKind({ name: /^Lead/ });
    screen.getByRole('button', { name: /^Stops: / });

    await pickKind({ name: /^Agent/ });
    expect(screen.queryByRole('button', { name: /^Stops/ })).toBeNull();
  });

  it('starts the preset Lead on the Stops level you picked', async () => {
    const changeAutoLevel = vi.fn<AppStore['changeAutoLevel']>(async () => undefined);
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      changeAutoLevel,
    });
    await openPage();
    await pickKind({ name: /^Preset/ });
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    fireEvent.click(screen.getByRole('button', { name: /^Stops:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(changeAutoLevel).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: cameFrom.id, level: 'run' }),
    );
    expect(attach).not.toHaveBeenCalled();
  });

  it('names the workflow that fits on the Auto pill, and picking it is free to change steps', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();
    typeGoal(GOAL);
    expect(workflowPill()?.textContent).toBe('WorkflowAuto');

    typeGoal(FITTING_GOAL);
    expect(workflowPill()?.textContent).toBe('WorkflowAuto · likely Scout, plan, build');
    expect(document.querySelector('[data-run-route-line]')?.textContent).not.toContain(
      'Scout, plan, build',
    );
    await chooseOption({ box: 'Workflow', option: /^Scout, plan, build/ });

    expect(isPicked({ name: /^Preset/ })).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Keep its steps as written' }).checked,
    ).toBe(false);
    screen.getByText(
      'The Lead starts from Scout, plan, build and says why when it changes a step.',
    );
    fireEvent.click(startButton());

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(FITTING_GOAL);
  });

  it('reads a draft whose workflow is gone as Auto and still starts', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: {
        startKind: 'workflow',
        startShape: 'preset',
        workflowId: brandedId<WorkflowId>({ value: 'wf-deleted' }),
        hasChosenStart: true,
      },
    });
    await openPage();

    expect(workflowPill()?.textContent).toBe('WorkflowAuto');
    typeGoal(GOAL);
    fireEvent.click(startButton());

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(GOAL);
  });

  it('writes no workflow for Auto and the workflow id for a pick', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowId ?? null).toBeNull();
    await pickKind({ name: /^Preset/ });
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowId).toBe(PRESET_ID);
    await pickKind({ name: /^Lead/ });
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowId).toBeNull();
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.startKind).toBe('auto');
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

    const steps = screen.getByRole('list', { name: 'Workflow steps' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep its steps as written' }));
    screen.getByText('The Lead runs its one step as written.');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(attach).not.toHaveBeenCalled();
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(GOAL);
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
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

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
    const chip = screen.getByRole('button', { name: /^Change the .* model for this run/ });
    expect(chip.getAttribute('data-run-model')).toBe('auto');
    expect(chip.getAttribute('aria-label')).toMatch(/, Auto$/);

    fireEvent.click(chip);
    await settle();
    screen.getByRole('button', { name: 'Change the default in Every run' });
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    await settle();

    const picked = useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.agentRouting;
    expect(picked).toMatchObject({ provider: 'cursor' });
    expect(
      screen
        .getByRole('button', { name: /^Change the .* model for this run/ })
        .getAttribute('data-run-model'),
    ).toBe('pinned');
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent).toHaveBeenCalledWith(
      cameFrom.id,
      expect.objectContaining({ provider: 'cursor' }),
    );
  });

  it('starts a Lead with the goal', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Lead/ });

    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

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
    await pickKind({ name: /^Preset/ });
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('The folder is locked by another window')).toBeDefined();
    expect(textBox('Goal').value).toBe(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
  });

  it('drops a late answer once you left the page', async () => {
    const late: { fail: (error: Error) => void } = { fail: () => undefined };
    const pending: AppStore['startSessionFromDraft'] = () =>
      new Promise((_resolve, reject) => {
        late.fail = reject;
      });
    useAppStore.setState({ startSessionFromDraft: pending, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Lead/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();

    cleanup();
    late.fail(new Error('Late failure'));
    await settle();
    await renderPage();

    expect(screen.queryByText('Late failure')).toBeNull();
    screen.getByRole('button', { name: 'Start' });
  });

  it('attaches a task on any kind, starts on it, and Remove takes it off', async () => {
    const start = vi.fn<AppStore['startSessionFromDraft']>(startThenRun);
    useAppStore.setState({ startSessionFromDraft: start, loadSetting: noSetting });
    await openPage();
    await pickKind({ name: /^Lead/ });
    screen.getByRole('combobox', { name: 'Pick from Tasks' });

    act(() =>
      useAppStore.getState().patchSessionDraft({
        workspaceId: WORKSPACE_ID,
        patch: { pickedIssues: [TASK], workflowGoal: TASK.goal },
      }),
    );
    await settle();
    expect(screen.queryByRole('combobox', { name: 'Pick from Tasks' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
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
    await pickKind({ name: /^Preset/ });
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
  const RUN_DEFAULT = /^Limit: \$8\.00 · default$/;

  type TypeLimitParams = {
    readonly usd: string;
  };

  const typeLimit = async ({ usd }: TypeLimitParams): Promise<void> => {
    fireEvent.click(screen.getByRole('button', { name: /^Limit: / }));
    await settle();
    fireEvent.change(screen.getByRole('textbox', { name: 'Other amount' }), {
      target: { value: usd },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this limit' }));
    await settle();
  };

  it('starts every kind from the Run defaults limit, and Agent has no limit', async () => {
    withRunDefault();
    await openPage();

    screen.getByRole('button', { name: RUN_DEFAULT });
    await pickKind({ name: /^Preset/ });
    screen.getByRole('button', { name: RUN_DEFAULT });
    await pickKind({ name: /^Lead/ });
    screen.getByRole('button', { name: RUN_DEFAULT });
    await pickKind({ name: /^Agent/ });
    expect(screen.queryByRole('button', { name: /^Limit: / })).toBeNull();
  });

  it('starts a Preset run as a Lead under the Run defaults limit', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Preset/ });
    typeGoal(GOAL);
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    screen.getByRole('button', { name: RUN_DEFAULT });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ kindOverride: 'auto' });
    expect(attach).not.toHaveBeenCalled();
  });

  it('keeps a typed amount when the kind changes', async () => {
    withRunDefault();
    await openPage();
    await pickKind({ name: /^Preset/ });
    await typeLimit({ usd: '3' });

    await pickKind({ name: /^Lead/ });

    screen.getByRole('button', { name: 'Limit: $3.00' });
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

    await pickKind({ name: /^Preset/ });
    expect(chipNames()).toEqual(
      expect.arrayContaining(['Stops', 'Edits', expect.stringMatching(/^Limit/)]),
    );
    await pickKind({ name: /^Agent/ });
    expect(chipNames()).toEqual(expect.arrayContaining(['Edits']));
    expect(chipNames().some((name) => name.startsWith('Limit') || name === 'Stops')).toBe(false);
    screen.getByRole('combobox', { name: 'Role' });
  });

  it('opens a popover from every chip of the row', async () => {
    await openPage();
    await pickKind({ name: /^Preset/ });

    const row = within(screen.getByRole('group', { name: 'Run settings' }));
    const chips: ReadonlyArray<RegExp> = [/^Stops:/, /^Edits:/, /^Limit: /, /^Guidance:/];
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
    await pickKind({ name: /^Lead/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: /^Edits:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: /^Read only/ }));
    await settle();
    screen.getByRole('button', { name: /^Edits: Read only, this session/ });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

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
    await pickKind({ name: /^Lead/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(setMode).not.toHaveBeenCalled();
  });

  it('starts the Auto agent on the Stops level picked for it', async () => {
    const changeAutoLevel = vi.fn<AppStore['changeAutoLevel']>(async () => undefined);
    useAppStore.setState({
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
      changeAutoLevel,
    });
    await openPage();
    await pickKind({ name: /^Lead/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: /^Stops:/ }));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

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

    for (const name of [/^Lead/, /^Preset/, /^Agent/]) {
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
      [/^Lead/, 'Read by the Lead and the agents it starts.'],
      [/^Agent/, 'Read by the agent at the start of its brief.'],
      [/^Preset/, 'Read by the Lead and the agents it starts.'],
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
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: RUN_GUIDANCE });
    expect(kickoffOf()).toBe(GOAL);
  });

  it('hands the workspace guidance to the Auto agent when you leave it alone', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Lead/ });
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      guidance: WORKSPACE_GUIDANCE,
    });
  });

  it('hands the guidance you wrote to a preset Lead', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Preset/ });
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    await editGuidance(RUN_GUIDANCE);
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      guidance: RUN_GUIDANCE,
    });
  });

  it('sends an empty guidance when you press No guidance', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Preset/ });
    await chooseOption({ box: 'Workflow', option: /Scout, plan, build/ });
    fireEvent.click(guidanceChip());
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'No guidance' }));
    await settle();
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();
    expect(guidanceChip().getAttribute('aria-label')).toBe('Guidance: None, this run');
    typeGoal(GOAL);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: '' });
  });

  it('puts the workspace guidance back with Use workspace guidance', async () => {
    withWorkspaceGuidance();
    await openPage();
    await pickKind({ name: /^Lead/ });
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
    await pickKind({ name: /^Preset/ });
    await editGuidance(RUN_GUIDANCE);

    await pickKind({ name: /^Agent/ });
    await pickKind({ name: /^Lead/ });

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
    await pickKind({ name: /^Lead/ });
    await editGuidance(RUN_GUIDANCE);
    typeGoal(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('The folder is locked by another window')).toBeDefined();
    expect(guidanceChip().getAttribute('aria-label')).toBe(`Guidance: ${RUN_GUIDANCE}, this run`);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ guidance: RUN_GUIDANCE });
  });
});
