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

import { PROVIDER_CAPABILITIES } from '@goodboy/core';
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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { AppStore } from '../../../../store/store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WritePanel } from '../../../artifacts/components/WritePanel';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import { NewDrawer } from '../NewDrawer';
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

type OpenPageParams = {
  readonly choice: 'task' | 'workflow' | 'orchestrate' | 'scout';
  readonly isAuto?: boolean;
};

const openPage = async ({ choice, isAuto }: OpenPageParams): Promise<void> => {
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: cameFrom.id }) });
  useAppStore.getState().openSessionDraft();
  useAppStore.getState().patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { choice } });
  render(
    <ToastProvider>
      <SessionDraftPane workspaceId={WORKSPACE_ID} {...(isAuto !== undefined && { isAuto })} />
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
  const element = screen.getByRole('button', { name: /start (run|orchestration)/i });
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Expected a button');
  }
  return element;
};

const kickoffTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'How do you want to start?' })).getByRole('tab', {
    name,
  });

describe('New session page, selector', () => {
  it('is one compact selector with the line right after the selection, none under each option', async () => {
    await openPage({ choice: 'workflow' });

    const tabs = within(screen.getByRole('tablist', { name: 'How do you want to start?' }));
    expect(tabs.getAllByRole('tab').map((node) => node.textContent)).toEqual([
      'Pick up a task',
      'Run a workflow',
      'Orchestrate',
      'Ask an agent',
    ]);
    expect(screen.getByText('Several agents work through your goal, step by step.')).toBeDefined();
    expect(screen.queryByText('An issue from your tracker.')).toBeNull();

    fireEvent.click(kickoffTab('Ask an agent'));
    expect(screen.getByText('One agent in the role you pick.')).toBeDefined();
    expect(screen.queryByText('Several agents work through your goal, step by step.')).toBeNull();

    fireEvent.click(kickoffTab('Pick up a task'));
    expect(screen.getByText('Start from an issue in your tracker.')).toBeDefined();
  });

  it('keeps Start blank in the header and Discard in the actions row once something is written', async () => {
    await openPage({ choice: 'workflow' });

    expect(screen.getByRole('button', { name: /start blank/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });

    expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
  });
});

describe('New session page, Run lane', () => {
  it('starts the same run from the page as from the drawer', async () => {
    const drawer = render(
      <ToastProvider>
        <NewDrawer
          sessionId={cameFrom.id}
          payload={{ form: 'orchestrate' }}
          writePanel={WritePanel}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );
    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });
    fireEvent.click(startButton());
    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    const fromDrawer = attach.mock.calls[0];
    drawer.unmount();
    attach.mockClear();
    await settle();

    await openPage({ choice: 'orchestrate' });
    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });
    fireEvent.click(startButton());
    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    const fromPage = attach.mock.calls[0];

    expect(createSession).toHaveBeenCalledOnce();
    expect(fromPage?.[0]).toBe(cameFrom.id);
    expect(fromPage?.[2]).toEqual(fromDrawer?.[2]);
    expect(fromPage?.[2]).toMatchObject({ goal: GOAL, executionMode: 'dynamic', navigate: true });
  });

  it('blocks the start with Preset when the spend cap is switched on and left empty', async () => {
    await openPage({ choice: 'workflow' });
    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });
    fireEvent.click(screen.getByRole('button', { name: /^preset:/i }));
    fireEvent.click(screen.getByRole('option', { name: /scout, plan, build/i }));
    expect(startButton().disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^limit:/i }));
    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));

    expect(startButton().disabled).toBe(true);
    expect(screen.getByText('Enter a valid limit to start')).toBeDefined();
    fireEvent.click(startButton());
    await settle();
    expect(createSession).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it('carries a valid spend cap onto a started preset', async () => {
    await openPage({ choice: 'workflow' });
    fireEvent.change(textBox('Goal'), { target: { value: GOAL } });
    fireEvent.click(screen.getByRole('button', { name: /^preset:/i }));
    fireEvent.click(screen.getByRole('option', { name: /scout, plan, build/i }));
    fireEvent.click(screen.getByRole('button', { name: /^limit:/i }));
    fireEvent.click(screen.getByRole('switch', { name: /^limit$/i }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), { target: { value: '9' } });

    fireEvent.click(startButton());

    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    expect(attach.mock.calls[0]?.[2]).toMatchObject({ spendLimitUsd: 9 });
  });
});

describe('New session page, Ask an agent', () => {
  it('opens the role start with Auto always available, with the role and no Auto', async () => {
    await openPage({ choice: 'scout' });

    expect(textBox('Scout focus')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start Scout on the whole project' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Auto' })).toBeNull();
  });

  it('moves the goal written for Auto into the instructions of the legacy form, never dropping it', async () => {
    useAppStore.getState().openSessionDraft();
    useAppStore
      .getState()
      .patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { autoGoal: GOAL } });

    await openPage({ choice: 'scout' });

    expect(textBox('Scout focus').value).toBe(GOAL);
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.autoGoal).toBe('');
  });
});

describe('New session page, Ask an agent drawn as the Auto composer', () => {
  beforeEach(() => {
    useAppStore.setState({
      providers: [
        {
          id: 'anthropic',
          binary: 'anthropic',
          capabilities: PROVIDER_CAPABILITIES.anthropic,
          connection: 'connected',
          version: null,
          identity: null,
          label: 'anthropic',
          error: null,
          docsUrl: '',
        },
      ],
    });
  });

  it('moves the instructions written for the legacy form into the Auto goal', async () => {
    useAppStore.getState().openSessionDraft();
    useAppStore
      .getState()
      .patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { agentPrompt: GOAL } });

    await openPage({ choice: 'scout', isAuto: true });

    expect(textBox('Describe the work').value).toBe(GOAL);
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.agentPrompt).toBe('');
  });

  it('is the Auto composer: one goal, Projects, one model chip and no roles', async () => {
    await openPage({ choice: 'scout', isAuto: true });

    expect(
      screen.getByText('Auto answers, or hands the work to the roles it picks.'),
    ).toBeDefined();
    expect(screen.getByRole('region', { name: 'Auto' })).toBeDefined();
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.queryByText('It may not work well yet.')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Model:/ })).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Project' })).toBeDefined();
    expect(screen.queryByText(/guidance/i)).toBeNull();
  });

  it('keeps Start Auto disabled until the work is described', async () => {
    await openPage({ choice: 'scout', isAuto: true });

    const start = screen.getByRole('button', { name: 'Start Auto' });
    expect(start).toHaveProperty('disabled', true);
    fireEvent.change(textBox('Describe the work'), { target: { value: GOAL } });
    expect(screen.getByRole('button', { name: 'Start Auto' })).toHaveProperty('disabled', false);
  });

  it('creates the session and starts Auto with the goal on the auto agent', async () => {
    await openPage({ choice: 'scout', isAuto: true });
    fireEvent.change(textBox('Describe the work'), { target: { value: GOAL } });

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(createSession).toHaveBeenCalledOnce();
    expect(spawnAgent.mock.calls[0]?.[0]).toBe(cameFrom.id);
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      initialPrompt: GOAL,
    });
    await waitFor(() =>
      expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.autoGoal ?? '').toBe(''),
    );
  });

  it('keeps the goal and shows the error when the start fails', async () => {
    createSession.mockRejectedValueOnce(new Error('disk full'));
    await openPage({ choice: 'scout', isAuto: true });
    fireEvent.change(textBox('Describe the work'), { target: { value: GOAL } });

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('disk full'));
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(textBox('Describe the work').value).toBe(GOAL);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
  });

  it('counts the Auto goal as a draft, so Discard draft appears and clears it', async () => {
    await openPage({ choice: 'scout', isAuto: true });
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    fireEvent.change(textBox('Describe the work'), { target: { value: GOAL } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await settle();

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });
});
