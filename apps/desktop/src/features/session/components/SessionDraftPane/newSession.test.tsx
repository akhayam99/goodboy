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
  return cameFrom;
};

describe('New session page', () => {
  it('is the Start a run field with Folders above it, and no start tabs', async () => {
    await openPage();

    expect(screen.queryByRole('tablist')).toBeNull();
    const kickoff = within(screen.getByRole('region', { name: 'Kickoff' }));
    expect(kickoff.getByRole('textbox', { name: 'Start a run' })).toBeDefined();
    expect(kickoff.queryByRole('button', { name: 'Start an agent' })).toBeNull();
    expect(kickoff.queryByRole('button', { name: 'Run a workflow' })).toBeNull();
  });

  it('keeps Start blank in the header and Discard in the actions row once something is written', async () => {
    await openPage();

    expect(screen.getByRole('button', { name: /start blank/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    fireEvent.change(textBox('Start a run'), { target: { value: GOAL } });

    expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
  });

  it('creates the session and starts one agent with the ask Auto could not place', async () => {
    useAppStore.setState({ startSessionFromDraft: startThenRun, loadSetting: noSetting });
    await openPage();

    fireEvent.change(textBox('Start a run'), { target: { value: GOAL } });
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

    fireEvent.change(textBox('Start a run'), { target: { value: `~Scout, plan, build ${GOAL}` } });
    fireEvent.click(startButton());

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0]?.[0]).toBe(cameFrom.id);
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      rulesSnapshot: { route: { row: 1, presetName: 'Scout, plan, build', closeness: 'follow' } },
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
