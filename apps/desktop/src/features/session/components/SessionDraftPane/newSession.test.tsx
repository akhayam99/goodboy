// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

vi.mock('../../../auto/useAutoTreeLimit', () => ({
  useAutoTreeLimit: () => ({
    usd: 5,
    isFromSession: false,
    isStored: true,
    change: () => undefined,
    persist: async () => undefined,
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const autoPicks = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Not sure? Describe it and Auto picks' }));
  await settle();
};

const KINDS = 'What kind of run?';

type PickParams = {
  readonly list: string;
  readonly name: RegExp;
};

const cardOf = ({ list, name }: PickParams): HTMLElement =>
  within(screen.getByRole('tablist', { name: list })).getByRole('tab', { name });

const pick = async ({ list, name }: PickParams): Promise<void> => {
  fireEvent.click(cardOf({ list, name }));
  await settle();
};

const isPicked = ({ list, name }: PickParams): boolean =>
  cardOf({ list, name }).getAttribute('aria-selected') === 'true';

describe('New session page', () => {
  it('opens on the task first, with Tasks and Where in its bottom row and no Folders field', async () => {
    await openPage();

    const task = within(screen.getByRole('region', { name: 'Goal' }));
    expect(textBox('Goal').placeholder).toBe('Describe the goal, or pick one from Tasks');
    task.getByRole('combobox', { name: 'Pick from Tasks' });
    expect(task.getByRole('combobox', { name: 'Where' }).textContent).toContain('Auto picks');
    expect(screen.queryByRole('region', { name: 'Folders' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start workflow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('asks for the kind on two explained cards under the task', async () => {
    await openPage();

    const kinds = within(screen.getByRole('tablist', { name: KINDS }));
    expect(kinds.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
    ]);
    expect(kinds.getAllByText('Example')).toHaveLength(2);
    expect(screen.queryByRole('tablist', { name: 'Which workflow?' })).toBeNull();
  });

  it('shows the two kinds of the picked card and folds the first cards', async () => {
    await openPage();

    await pick({ list: KINDS, name: /^Workflow/ });

    expect(isPicked({ list: KINDS, name: /^Workflow/ })).toBe(true);
    const kinds = within(screen.getByRole('tablist', { name: KINDS }));
    expect(kinds.queryByText('Example')).toBeNull();
    const shapes = within(screen.getByRole('tablist', { name: 'Which workflow?' }));
    const [orchestrated, preset] = shapes.getAllByRole('tab');
    expect(orchestrated?.textContent?.startsWith('Orchestrated')).toBe(true);
    expect(preset?.textContent?.startsWith('Preset')).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'Not sure? Describe it and Auto picks' }),
    ).toBeNull();
  });

  it('keeps the goal when you switch from one kind to the other', async () => {
    await openPage();
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { workflowGoal: GOAL },
    });

    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Auto agent/ });

    expect(isPicked({ list: 'Which agent?', name: /^Auto agent/ })).toBe(true);
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal).toBe(GOAL);
  });

  it('swaps the cards for Auto picks under the same task, and Pick it yourself brings them back', async () => {
    await openPage();

    await autoPicks();

    expect(screen.queryByRole('tablist', { name: KINDS })).toBeNull();
    const auto = within(screen.getByRole('region', { name: 'Start a run' }));
    auto.getByText('Auto picks a workflow or an agent. Type ~preset or @role.');
    expect(textBox('Goal')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pick it yourself' }));
    await settle();
    screen.getByRole('tablist', { name: KINDS });
    expect(screen.queryByRole('region', { name: 'Start a run' })).toBeNull();
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

    expect(isPicked({ list: KINDS, name: /^Workflow/ })).toBe(true);
    expect(isPicked({ list: 'Which workflow?', name: /^Preset/ })).toBe(true);
  });

  it('keeps the pick of this window when another window starts something else', async () => {
    let last: string | null = null;
    const loadSetting: AppStore['loadSetting'] = async () => last;
    useAppStore.setState({ loadSetting });
    await openPage();
    await pick({ list: KINDS, name: /^Agent/ });

    last = 'preset';
    cleanup();
    render(
      <ToastProvider>
        <SessionDraftPane workspaceId={WORKSPACE_ID} />
      </ToastProvider>,
    );
    await settle();

    expect(isPicked({ list: KINDS, name: /^Agent/ })).toBe(true);
    expect(screen.queryByRole('tablist', { name: 'Which workflow?' })).toBeNull();
  });

  it('keeps Start blank in the header and Discard in the actions row once something is written', async () => {
    await openPage();
    await autoPicks();

    screen.getByRole('button', { name: /start blank/i });
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });

    expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
  });

  it('creates the session and starts one agent with the ask Auto could not place', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();
    await autoPicks();

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
    await autoPicks();

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
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });

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

  it('shows Asks you on the workflow kinds only, named like the run page', async () => {
    await openPage();
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
    screen.getByRole('button', { name: /^Asks you: Every step, / });

    await pick({ list: 'Which workflow?', name: /^Preset/ });
    screen.getByRole('button', { name: /^Asks you: Every step, / });

    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Auto agent/ });
    expect(screen.queryByRole('button', { name: /^Asks you/ })).toBeNull();
    await pick({ list: 'Which agent?', name: /^Agent/ });
    expect(screen.queryByRole('button', { name: /^Asks you/ })).toBeNull();
  });

  it('starts a workflow that asks at every step when Asks you is left alone', async () => {
    useAppStore.setState({
      generateWorkflowTitle: vi.fn(async () => undefined),
      startSessionFromDraft: startThenRun,
      loadSetting: noSetting,
    });
    await openPage();
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
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
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
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
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Preset/ });
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
    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Agent/ });

    expect(screen.queryByText(/^Limit/)).toBeNull();
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

  it('starts Auto agent with the goal', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();
    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Auto agent/ });

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
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
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
    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Auto agent/ });
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
    await pick({ list: KINDS, name: /^Agent/ });
    await pick({ list: 'Which agent?', name: /^Auto agent/ });
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
    await pick({ list: KINDS, name: /^Workflow/ });
    await pick({ list: 'Which workflow?', name: /^Orchestrated/ });
    typeGoal(GOAL);

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();
    screen.getByText('Keep this draft?');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await settle();
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });
});
