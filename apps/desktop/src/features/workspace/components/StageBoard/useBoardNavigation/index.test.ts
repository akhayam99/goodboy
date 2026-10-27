// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { currentStack } from '../../../../../store/slices/navigation/currentStack';
import { useBoardNavigation } from './index';

const session = aSession();
const SESSION_ID = session.id;
const STAMP = brandId<IsoDateTime>({ value: '2026-10-23T09:00:00.000Z' });
const LATER = brandId<IsoDateTime>({ value: '2026-10-23T10:00:00.000Z' });

let useAppStore: StoryStore;

const editorCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'open_in_editor');

const landedAt = () => {
  const stack = currentStack(useAppStore.getState());
  return stack.entries[stack.index]?.place;
};

const stackDepth = () => currentStack(useAppStore.getState()).entries.length;

type RecordEventsParams = { readonly type: string };

const recordEvents = ({ type }: RecordEventsParams) => {
  const seen: Event[] = [];
  const listener = (event: Event) => {
    seen.push(event);
  };
  window.addEventListener(type, listener);
  return { seen, stop: () => window.removeEventListener(type, listener) };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ open_in_editor: async () => null });
});

afterEach(cleanup);

describe('useBoardNavigation', () => {
  it('selectCard opens the overview of the card as one history voice', () => {
    const before = stackDepth();
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.selectCard(session));
    expect(stackDepth()).toBe(before + 1);
    expect(landedAt()).toMatchObject({ at: 'session', sessionId: SESSION_ID });
  });

  it('openUnreadReply opens the agent with the reply, not the first agent, then reveals chat', () => {
    const planner = anAgent({
      sessionId: SESSION_ID,
      name: 'Planner',
      ordinal: 1,
      lastFinishedAt: STAMP,
      lastViewedAt: LATER,
    });
    const tester = anAgent({
      sessionId: SESSION_ID,
      name: 'Tester',
      ordinal: 2,
      lastFinishedAt: LATER,
      lastViewedAt: STAMP,
    });
    act(() => {
      useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [planner, tester] } });
    });
    const reveals = recordEvents({ type: 'goodboy:reveal-chat' });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openUnreadReply(session));
    reveals.stop();
    expect(landedAt()).toMatchObject({ sessionId: SESSION_ID, view: { agentId: tester.id } });
    expect(reveals.seen).toHaveLength(1);
  });

  it('openUnreadReply takes the latest agent when several replied', () => {
    const first = anAgent({
      sessionId: SESSION_ID,
      ordinal: 1,
      lastFinishedAt: LATER,
    });
    const second = anAgent({
      sessionId: SESSION_ID,
      ordinal: 2,
      lastFinishedAt: LATER,
    });
    act(() => {
      useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [second, first] } });
    });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openUnreadReply(session));
    expect(landedAt()).toMatchObject({ sessionId: SESSION_ID, view: { agentId: second.id } });
  });

  it('openUnreadReply with nothing unread opens the overview and still reveals chat', () => {
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [SESSION_ID]: [
            anAgent({
              sessionId: SESSION_ID,
              lastFinishedAt: STAMP,
              lastViewedAt: LATER,
            }),
          ],
        },
      });
    });
    const reveals = recordEvents({ type: 'goodboy:reveal-chat' });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openUnreadReply(session));
    reveals.stop();
    expect(landedAt()).toMatchObject({ at: 'session', sessionId: SESSION_ID });
    expect(reveals.seen).toHaveLength(1);
  });

  it.each([
    ['openQuestions', 'questions'],
    ['openWorkflows', 'workflows'],
  ] as const)('%s opens the %s lens', (action, lens) => {
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current[action](session));
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe(lens);
  });

  it('openIDE opens the first worktree path in the default editor', async () => {
    act(() => {
      useAppStore.setState({ sessionWorktrees: { [SESSION_ID]: ['/code/ledger-core'] } });
    });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openIDE(session));
    await vi.waitFor(() => expect(editorCalls()).toHaveLength(1));
    expect(editorCalls()[0]?.[1]).toEqual({ path: '/code/ledger-core', editor: 'code' });
  });

  it('openIDE opens the editor chosen in settings', async () => {
    act(() => {
      useAppStore.setState({
        sessionWorktrees: { [SESSION_ID]: ['/code/ledger-core'] },
        settings: { 'editor.binary': 'zed' },
      });
    });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openIDE(session));
    await vi.waitFor(() => expect(editorCalls()).toHaveLength(1));
    expect(editorCalls()[0]?.[1]).toEqual({ path: '/code/ledger-core', editor: 'zed' });
  });

  it('openIDE reports a failure to open the editor and opens it again on retry', async () => {
    act(() => {
      useAppStore.setState({ sessionWorktrees: { [SESSION_ID]: ['/code/ledger-core'] } });
    });
    stubStoryInvoke({
      open_in_editor: async () => {
        throw new Error("editor binary 'code' not found in PATH");
      },
    });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openIDE(session));
    await vi.waitFor(() => expect(editorCalls()).toHaveLength(1));
    await vi.waitFor(() =>
      expect(
        useAppStore.getState().notifications.some((n) => n.title === "Couldn't open the editor"),
      ).toBe(true),
    );
    stubStoryInvoke({ open_in_editor: async () => null });
    act(() => result.current.openIDE(session));
    await vi.waitFor(() => expect(editorCalls()).toHaveLength(2));
  });

  it('openIDE does nothing when no worktree exists', () => {
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openIDE(session));
    expect(editorCalls()).toHaveLength(0);
  });

  it('openPullRequest lands on the pull request in one push', () => {
    const before = stackDepth();
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openPullRequest(session));
    expect(stackDepth()).toBe(before + 1);
    expect(useAppStore.getState().branchTab[SESSION_ID]).toBe('pr');
  });

  it('openReview opens the review target alone, with no studio overlay', () => {
    const before = stackDepth();
    const overlays = recordEvents({ type: 'goodboy:open-github-session' });
    const { result } = renderHook(() => useBoardNavigation());
    act(() => result.current.openReview(session));
    overlays.stop();
    expect(overlays.seen).toHaveLength(0);
    expect(stackDepth()).toBe(before);
  });
});
