// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionExternalTask } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { SessionContextCards } from '../../../../app/components/SessionContextCards';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { seedSessionAsk } from '../../../../app/components/MockScene/scenes/sessionAskSeed';
import { currentStack } from '../../../../store/slices/navigation/currentStack';
import { selectIsContextTabOpen } from '../../../../store/slices/contextDrawer/selectIsContextTabOpen';
import { ContextCardsContext } from '../../contextCardsContext';
import { ContextTab } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listSessionDecisions: async () => [],
    listAskThreads: async () => [],
  }),
);

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
  store.setState({ navigate: store.getInitialState().navigate });
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({}),
    worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
    detect_editors: () => [],
  });
});

afterEach(cleanup);

const session = () => {
  const found = store.getState().sessions.find((candidate) => candidate.id === SESSION_ID);
  if (found === undefined) {
    throw new Error('Missing session');
  }
  return found;
};

const mount = () =>
  render(
    <ContextCardsContext.Provider value={SessionContextCards}>
      <ContextTab session={session()} />
    </ContextCardsContext.Provider>,
  );

const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'ext-nw-142',
  identifier: 'NW-142',
  title: 'Retry webhook deliveries on a 502',
  url: 'https://linear.app/northwind/issue/NW-142',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
};

describe('the Context tab', () => {
  it('holds every section of the old panel: goal, decisions, summary, explanations and Ask', async () => {
    mount();

    const tab = await screen.findByTestId('context-tab');
    within(tab).getByRole('region', { name: 'Goal' });
    within(tab).getByRole('region', { name: 'Decision records' });
    within(tab).getByRole('region', { name: 'Summary' });
    within(tab).getByRole('region', { name: 'Explanations' });
    within(tab).getByRole('region', { name: 'Ask' });
    within(tab).getByRole('button', { name: 'Copy context' });
  });

  it('reaches the history of a section from its menu, inside the tab', async () => {
    store.setState({
      slotHistoryCounts: { [SESSION_ID]: { goal: 2, decisions: 2, last_output_summary: 2 } },
    });
    store.getState().openContextDrawer({ sessionId: SESSION_ID });
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'Summary actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Versions' }));

    await waitFor(() => {
      const stack = currentStack(store.getState());
      expect(stack.entries[stack.index]?.focus.returnRows).toMatchObject({
        'context.section': 'summary',
        'context.view': 'versions',
      });
    });
    expect(store.getState().drawer).toBeNull();
    expect(selectIsContextTabOpen({ state: store.getState(), sessionId: SESSION_ID })).toBe(true);
  });

  it('lists projects and linked work as cards, and a linked item opens with its own action', async () => {
    const open = vi.fn();
    store.setState({
      sessionExternalTasks: { [SESSION_ID]: [TASK] },
      openExternalTaskLens: open,
    });
    mount();

    const tab = await screen.findByTestId('context-tab');
    within(tab).getByRole('group', { name: 'Projects' });
    const linked = within(within(tab).getByRole('group', { name: 'Linked' }));
    expect(linked.getByRole('button', { name: 'Open NW-142' }).textContent).toBe(
      'NW-142Retry webhook deliveries on a 502',
    );
    linked.getByRole('button', { name: 'Link work' });

    fireEvent.click(linked.getByRole('button', { name: 'Open NW-142' }));

    expect(open).toHaveBeenCalledWith(SESSION_ID, TASK);
    within(tab).getByRole('group', { name: 'Linked' });
  });

  it('keeps the conversation of Ask when the tab is left and opened again, and starts no agent', async () => {
    const startedAgents = vi.fn();
    store.setState({ createSession: startedAgents });
    act(() => seedSessionAsk({ state: 'answer', session: session() }));
    const agentsBefore = store.getState().sessionPhaseRuns[SESSION_ID];
    const view = mount();
    await screen.findByTestId('ask-answer');
    const turns = screen.getAllByTestId('ask-answer').length;

    view.unmount();
    mount();

    expect(await screen.findAllByTestId('ask-answer')).toHaveLength(turns);
    expect(startedAgents).not.toHaveBeenCalled();
    expect(store.getState().sessionPhaseRuns[SESSION_ID]).toBe(agentsBefore);
  });

  it('opens the tab with the Ask input focused from ask.open, and leaves the input alone on a plain visit', async () => {
    mount();
    const field = await screen.findByRole('textbox', { name: 'Ask about this session' });
    expect(document.activeElement).not.toBe(field);

    act(() => store.getState().openAsk({ sessionId: SESSION_ID }));
    await waitFor(() => expect(document.activeElement).toBe(field));
  });
});
