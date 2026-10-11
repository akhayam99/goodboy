// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionExternalTask } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { GoalTeaser } from './GoalTeaser';
import { ToastProvider } from '../../../../shared/components/Toast';
import { GoalTab } from '../ContextDrawer/GoalTab';
import { bindTarget, runObjectAction } from '../../../actions/registry';
import type { ActionEnv } from '../../../actions/types';
import { SessionHeaderMenu } from './SessionHeaderMenu';

let store: StoryStore;
const session = aSession({ goal: 'Untitled session' });
const BRIEF = {
  title: 'Prevent duplicate credits',
  goal: 'Credit each invoice once.',
  acceptance: [],
};
const STORAGE_KEY = 'goodboy:goal-hint-dismissed:v1';

type TaskParams = { readonly identifier?: string; readonly externalId?: string };
const task = ({
  identifier = 'HL-204',
  externalId = 'issue-204',
}: TaskParams = {}): SessionExternalTask => ({
  sessionId: session.id,
  provider: 'linear',
  externalId,
  identifier,
  title: 'Fix duplicate credits',
  url: `https://linear.app/harborline/issue/${identifier}`,
  createdAt: session.createdAt,
});
const TASKS = [task(), task({ identifier: 'HL-211', externalId: 'issue-211' })];
type FieldParams = { readonly name: string };
const fieldValue = ({ name }: FieldParams) => {
  const field = screen.getByRole('textbox', { name });
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    throw new Error('Expected an editable proposal field');
  }
  return field.value;
};
type MountParams = { readonly current?: Session };
const mount = ({ current = session }: MountParams = {}) => render(<GoalTeaser session={current} />);
const ready = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Write' }));
  await waitFor(() => expect(fieldValue({ name: 'Proposed title' })).toBe(BRIEF.title));
};
const goal = () =>
  store.getState().sessionSlots[session.id]?.find((slot) => slot.key === 'goal')?.value ?? '';

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  localStorage.removeItem(STORAGE_KEY);
  store.setState({
    sessions: [session],
    sessionExternalTasks: {},
    sessionSlots: { [session.id]: [] },
    providers: [
      {
        id: 'anthropic',
        label: 'Claude',
        error: null,
        docsUrl: 'https://docs.anthropic.com',
        binary: 'claude',
        connection: 'connected',
        version: null,
        identity: null,
        capabilities: {
          models: [],
          supportsTools: true,
          supportsStream: true,
          supportsCheapModel: true,
        },
      },
    ],
  });
  stubStoryInvoke({
    linear_fetch_issue: {
      id: 'issue-204',
      identifier: 'HL-204',
      title: 'Fix duplicate credits',
      description: 'Prevent a second credit.',
      url: TASKS[0]?.url ?? '',
      state: { name: 'Open', type: 'unstarted' },
      team: { key: 'HL' },
      updatedAt: session.updatedAt,
    },
    summarize_session: {
      stdout: JSON.stringify({ result: JSON.stringify(BRIEF) }),
      stderr: '',
      exitCode: 0,
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GoalTeaser on the real store', () => {
  it('opens the goal drawer from the current goal', () => {
    store.setState({
      sessionSlots: {
        [session.id]: [{ key: 'goal', value: 'Credit each invoice once.', enabled: true }],
      },
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Goal: Credit each invoice once.' }));
    expect(store.getState().drawer).toEqual(expect.objectContaining({ sessionId: session.id }));
  });
  it('stays out of the way when the goal is the title', () => {
    store.setState({
      sessionSlots: { [session.id]: [{ key: 'goal', value: session.goal, enabled: true }] },
    });
    expect(mount().container.textContent).toBe('');
  });
  it('offers Add a goal without a linked issue', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Add a goal' })).toBeDefined();
  });
  it('holds a skeleton while the slots load', () => {
    store.setState({
      sessionSlots: {},
      sessionLoading: {
        [session.id]: {
          agents: false,
          transcript: false,
          telemetry: false,
          plans: false,
          summary: false,
          slots: true,
        },
      },
    });
    mount();
    expect(screen.getByRole('status', { name: 'Loading goal' })).toBeDefined();
  });
  it('hints from two linked issues and persists Not now across reloads', () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    expect(screen.getByText('Write the title and goal from HL-204 and HL-211?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    cleanup();
    mount();
    expect(screen.queryByRole('button', { name: 'Write' })).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([session.id]);
  });
  it('keeps dismissal per session and caps the persisted ids', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: 600 }, (_, index) => `old-${index}`)),
    );
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    const ids: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(ids).toHaveLength(500);
    cleanup();
    const other = aSession({ goal: 'Untitled session' });
    store.setState({ sessionExternalTasks: { [other.id]: TASKS } });
    mount({ current: other });
    expect(screen.getByRole('button', { name: 'Write' })).toBeDefined();
  });
  it('keeps dismissal in memory when storage is blocked', () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('button', { name: 'Write' })).toBeNull();
  });
  it('observes another window dismissing the hint', () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([session.id]));
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(screen.queryByRole('button', { name: 'Write' })).toBeNull();
  });
  it('uses a compact label for three issues', () => {
    store.setState({
      sessionExternalTasks: {
        [session.id]: [...TASKS, task({ identifier: 'HL-212', externalId: 'issue-212' })],
      },
    });
    mount();
    expect(screen.getByText('Write the title and goal from HL-204 and 2 more?')).toBeDefined();
  });
  it('reads only after a click and writes both fields with one Undo', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    expect(storySpies.tauriInvoke).not.toHaveBeenCalledWith('summarize_session', expect.anything());
    await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Proposed title' }), {
      target: { value: 'Fix credits' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use title and goal' }));
    await waitFor(() => expect(goal()).toBe(BRIEF.goal));
    expect(store.getState().sessions[0]?.goal).toBe('Fix credits');
    expect(store.getState().undoStack).toHaveLength(1);
    cleanup();
    expect(await store.getState().undoLastOperation({})).toBe(true);
    expect(store.getState().sessions[0]?.goal).toBe('Untitled session');
    expect(goal()).toBe('');
  });
  it('shows Replace and the current typed title', async () => {
    const typed = { ...session, goal: 'Fix credits', titleUserEdited: true };
    store.setState({ sessions: [typed], sessionExternalTasks: { [session.id]: TASKS } });
    mount({ current: typed });
    await ready();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeDefined();
    expect(screen.getByText('Now: Fix credits')).toBeDefined();
  });
  it('keeps the proposal and restores the title after a partial save fails, then retries', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    await ready();
    storySpies.upsertContextSlot.mockRejectedValueOnce(new Error('Goal write failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Use title and goal' }));
    await screen.findByRole('alert');
    expect(store.getState().sessions[0]?.goal).toBe(session.goal);
    expect(goal()).toBe('');
    expect(store.getState().undoStack).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(store.getState().undoStack).toHaveLength(1));
    expect(goal()).toBe(BRIEF.goal);
  });
  it('retries a model failure and offers titles when bodies cannot be read', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    let count = 0;
    stubStoryInvoke({
      linear_fetch_issue: () => {
        throw new Error('unavailable');
      },
      summarize_session: () => {
        count += 1;
        return count === 1
          ? { stdout: '', stderr: 'Model unavailable', exitCode: 1 }
          : { stdout: JSON.stringify({ result: JSON.stringify(BRIEF) }), stderr: '', exitCode: 0 };
      },
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fieldValue({ name: 'Proposed title' })).toBe(BRIEF.title));
    expect(
      screen.getByText('Based on the titles of HL-204 and HL-211. Their text could not be read.'),
    ).toBeDefined();
  });
  it('offers the registered menu and palette action after dismissal', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    const target = { kind: 'session' as const, sessionId: session.id };
    expect(
      bindTarget({ state: store.getState(), target })
        ?.resolve()
        .find((action) => action.id === 'session.writeFromWork')?.slot,
    ).toBe('menu');
    const env: ActionEnv = {
      getState: store.getState,
      showToast: vi.fn(),
      copyText: vi.fn(async () => undefined),
      origin: 'palette',
      anchorKey: null,
      viewing: null,
    };
    await runObjectAction({ target, actionId: 'session.writeFromWork', env });
    await waitFor(() => expect(fieldValue({ name: 'Proposed title' })).toBe(BRIEF.title));
  });
  it('keeps an edited proposal when unchanged linked rows refresh', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    const view = mount();
    await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Proposed title' }), {
      target: { value: 'Reconcile credits' },
    });
    store.setState({
      sessionExternalTasks: { [session.id]: TASKS.map((linked) => ({ ...linked })) },
    });
    view.rerender(<GoalTeaser session={session} />);
    expect(fieldValue({ name: 'Proposed title' })).toBe('Reconcile credits');
  });
  it('drops a late issue read after moving to another session', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    let finish: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const model = vi.fn(() => ({ stdout: '', stderr: '', exitCode: 0 }));
    stubStoryInvoke({ linear_fetch_issue: () => pending, summarize_session: model });
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    expect(screen.getByRole('status').textContent).toBe('Reading 2 issues');
    const other = aSession({ goal: 'Untitled session' });
    view.rerender(<GoalTeaser session={other} />);
    finish(null);
    await pending;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a goal' })).toBeDefined());
    expect(screen.queryByRole('textbox', { name: 'Proposed title' })).toBeNull();
    expect(model).not.toHaveBeenCalled();
  });
  it('keeps a new session proposal when an old session save finishes', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    const view = mount();
    await ready();
    let finish: () => void = () => undefined;
    const pending = new Promise<undefined>((resolve) => {
      finish = () => resolve(undefined);
    });
    storySpies.upsertContextSlot.mockImplementationOnce(() => pending);
    fireEvent.click(screen.getByRole('button', { name: 'Use title and goal' }));
    const other = aSession({ goal: 'Untitled session' });
    store.setState({
      sessions: [session, other],
      sessionExternalTasks: { [session.id]: TASKS, [other.id]: TASKS },
    });
    view.rerender(<GoalTeaser session={other} />);
    await ready();
    finish();
    await waitFor(() => expect(store.getState().undoStack).toHaveLength(1));
    expect(screen.getByRole('textbox', { name: 'Proposed title' })).toBeDefined();
    expect(store.getState().sessions.find((candidate) => candidate.id === other.id)?.goal).toBe(
      'Untitled session',
    );
  });
  it('uses five issues at most and explains the limit', async () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      task({ identifier: `HL-${204 + index}`, externalId: `issue-${index}` }),
    );
    store.setState({ sessionExternalTasks: { [session.id]: many } });
    mount();
    expect(screen.getByText('Write the title and goal from HL-204 and 5 more?')).toBeDefined();
    await ready();
    expect(screen.getByText('Based on the first five linked issues.')).toBeDefined();
  });
  it('shows the action in the header menu with at least two rows', () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    render(
      <ToastProvider>
        <SessionHeaderMenu session={session} onDelete={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More session actions' }));
    expect(
      screen.getByRole('menuitem', { name: 'Write title and goal from linked work' }),
    ).toBeDefined();
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2);
  });
  it('starts the proposal through the Goal tab button', async () => {
    store.setState({ sessionExternalTasks: { [session.id]: TASKS } });
    mount();
    render(
      <GoalTab
        sessionId={session.id}
        value=""
        historyCount={0}
        isLoading={false}
        isLocked={false}
        onOpenVersions={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Write title and goal from linked work' }));
    await waitFor(() => expect(fieldValue({ name: 'Proposed title' })).toBe(BRIEF.title));
  });
});
