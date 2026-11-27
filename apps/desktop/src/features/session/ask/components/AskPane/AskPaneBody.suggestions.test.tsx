// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

type Gate = { release: () => void; wait: Promise<void> | null };

const { asked, gate } = vi.hoisted(() => {
  const hoistedGate: Gate = { release: () => undefined, wait: null };
  return { asked: new Array<string>(), gate: hoistedGate };
});

vi.mock('../../activeAskBackend', async () => {
  const { createMemoryAskBackend } = await import('../../../../../test/createMemoryAskBackend');
  const backend = createMemoryAskBackend({
    respond: async ({ request, onText }) => {
      asked.push(request.prompt);
      onText('Nothing waits on you.');
      return { status: 'done' };
    },
  });
  return {
    activeAskBackend: {
      ...backend,
      insertThread: async (params: Parameters<typeof backend.insertThread>[0]) => {
        await gate.wait;
        return backend.insertThread(params);
      },
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { askInitialState } from '../../../../../store/slices/ask/state';
import { AskPaneBody } from './AskPaneBody';

const SUGGESTION = 'Where does this session stand?';

let useAppStore: StoryStore;
let sessionCount = 0;
let session = aSession();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  asked.length = 0;
  gate.wait = null;
  sessionCount += 1;
  session = aSession({
    id: brandId<SessionId>({ value: `session-harborline-${sessionCount}` }),
    goal: 'Keep the retry count after a redelivery',
  });
  useAppStore.setState({
    ...askInitialState,
    sessions: [session],
    currentSessionId: session.id,
  });
});

afterEach(() => {
  cleanup();
});

const renderPane = () =>
  render(
    <ToastProvider>
      <AskPaneBody session={session} onClose={() => undefined} />
    </ToastProvider>,
  );

const userQuestions = (): ReadonlyArray<string> => {
  const state = useAppStore.getState();
  const threadId = state.askThreadId[session.id] ?? null;
  return (threadId === null ? [] : (state.askMessages[threadId] ?? []))
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
};

describe('the Try asking suggestions', () => {
  it('asks the question at once and leaves the composer empty', async () => {
    renderPane();

    fireEvent.click(screen.getByRole('button', { name: SUGGESTION }));

    await waitFor(() => expect(userQuestions()).toEqual([SUGGESTION]));
    await screen.findByText('Nothing waits on you.');
    expect(asked).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Ask about this session' })).toHaveProperty(
      'value',
      '',
    );
  });

  it('asks once when the same suggestion is clicked twice before the thread exists', async () => {
    gate.wait = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    renderPane();
    const chip = screen.getByRole('button', { name: SUGGESTION });

    fireEvent.click(chip);
    fireEvent.click(chip);
    gate.release();

    await screen.findByText('Nothing waits on you.');
    expect(userQuestions()).toEqual([SUGGESTION]);
    expect(useAppStore.getState().askThreads[session.id]).toHaveLength(1);
    expect(asked).toHaveLength(1);
  });

  it('fills the composer only when the user types', () => {
    renderPane();
    const field = screen.getByRole('textbox', { name: 'Ask about this session' });

    fireEvent.change(field, { target: { value: 'Why is the retry slow?' } });

    expect(field).toHaveProperty('value', 'Why is the retry slow?');
    expect(userQuestions()).toEqual([]);
    expect(asked).toHaveLength(0);
  });
});
