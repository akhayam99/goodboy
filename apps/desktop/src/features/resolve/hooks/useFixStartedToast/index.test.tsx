// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { BOARD_PLACE } from '../../../../store/slices/navigation/place';
import { isUserStart } from '../../../../shared/lib/userStarts';
import { SESSION, seedResolveScene } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { useFixStartedToast } from '.';

let useAppStore: StoryStore;
let announce: ReturnType<typeof useFixStartedToast>;

const AGENT = 'mock-resolve-agent-idempotency' as AgentId;

const Caller = () => {
  announce = useFixStartedToast();
  return null;
};

const mountToasts = () =>
  render(
    <ToastProvider>
      <Caller />
    </ToastProvider>,
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const started = (batchId: string) => ({ batchId, launchId: 'launch-1', agentId: AGENT });

describe('useFixStartedToast', () => {
  it('raises one past-tense info toast that names the comments and the repository', () => {
    mountToasts();

    act(() => announce({ sessionId: SESSION.id, started: started('batch-1'), count: 3 }));

    expect(screen.getByText('Fix run started')).toBeDefined();
    expect(screen.getByText('3 comments on payments-api')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Follow' })).toHaveLength(1);
  });

  it('says the fix queued when another fix holds the lane', () => {
    const state = useAppStore.getState();
    const attempts = state.sessionResolveAttempts[SESSION.id] ?? [];
    useAppStore.setState({
      sessionResolveAttempts: {
        ...state.sessionResolveAttempts,
        [SESSION.id]: attempts.map((attempt) =>
          attempt.agentId === AGENT ? { ...attempt, phase: 'queued' as const } : attempt,
        ),
      },
    });
    mountToasts();

    act(() => announce({ sessionId: SESSION.id, started: started('batch-2'), count: 1 }));

    expect(screen.getByText('Fix queued after the current fix')).toBeDefined();
    expect(screen.getByText('1 comment on payments-api')).toBeDefined();
  });

  it('opens the transcript of the fix run on the Comments tab when you press Follow', () => {
    mountToasts();
    useAppStore.getState().navigate({ to: BOARD_PLACE });

    act(() => announce({ sessionId: SESSION.id, started: started('batch-3'), count: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    const { drawer } = useAppStore.getState();
    expect(drawer).toMatchObject({
      kind: 'transcript',
      sessionId: SESSION.id,
      payload: { agentId: AGENT },
    });
  });

  it('raises nothing a second time for the same batch and marks the start as yours', () => {
    mountToasts();

    act(() => {
      announce({ sessionId: SESSION.id, started: started('batch-4'), count: 2 });
      announce({ sessionId: SESSION.id, started: started('batch-4'), count: 2 });
    });

    expect(screen.getAllByText('Fix run started')).toHaveLength(1);
    expect(isUserStart({ key: 'batch:batch-4' })).toBe(true);
    expect(isUserStart({ key: AGENT })).toBe(true);
  });
});
