// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const { turn } = vi.hoisted(() => {
  const state: {
    texts: Array<string>;
    gate: Promise<void> | null;
    questions: Array<string>;
  } = { texts: [], gate: null, questions: [] };
  return { turn: state };
});

vi.mock('../../activeAskBackend', async () => {
  const { createMemoryAskBackend } = await import('../../../../../test/createMemoryAskBackend');
  return {
    activeAskBackend: createMemoryAskBackend({
      respond: async ({ request, onText }) => {
        turn.questions.push(request.prompt);
        onText(turn.texts.shift() ?? 'Done.');
        await turn.gate;
        return { status: 'done' };
      },
    }),
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type ChatId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { askInitialState } from '../../../../../store/slices/ask/state';
import { SessionAskLine } from './index';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const QUESTION = 'Why did integration-tests fail?';

const tauri: { liveWork: (() => Promise<unknown>) | null } = { liveWork: null };

type InvokeParams = {
  readonly command: string;
};

const answerOf = async ({ command }: InvokeParams): Promise<unknown> => {
  if (command === 'live_work') {
    return tauri.liveWork === null ? [] : tauri.liveWork();
  }
  if (command === 'db_transaction') {
    return { status: 'committed', results: [] };
  }
  if (command === 'db_select') {
    return [];
  }
  return command.startsWith('db_') ? { rowsAffected: 1 } : null;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  tauri.liveWork = null;
  turn.texts = [];
  turn.gate = null;
  turn.questions = [];
  storySpies.tauriInvoke.mockImplementation((command) => answerOf({ command: String(command) }));
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION, goal: 'Keep the retry count after a redelivery' })],
  });
});

afterEach(() => {
  cleanup();
});

type GateParams = {
  readonly texts: ReadonlyArray<string>;
};

const holdTurn = ({ texts }: GateParams): (() => void) => {
  let release: () => void = () => undefined;
  turn.texts = [...texts];
  turn.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
};

const askQuestion = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about this session' }), {
    target: { value: QUESTION },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
};

describe('the Ask line, asking the model', () => {
  it('keeps its own reply when the Ask panel switches thread while it runs', async () => {
    const release = holdTurn({ texts: ['The retry test timed out in ledger-core.'] });
    render(<SessionAskLine sessionId={SESSION} />);
    askQuestion();
    await screen.findByText('The retry test timed out in ledger-core.');

    act(() => {
      useAppStore.setState((state) => ({
        askThreadId: { ...state.askThreadId, [SESSION]: brandId<ChatId>({ value: 'chat-other' }) },
      }));
    });
    await act(async () => {
      release();
    });

    screen.getByText('The retry test timed out in ledger-core.');
  });

  it('never shows a later question from the Ask panel under its own question', async () => {
    turn.texts = ['The retry test timed out in ledger-core.', 'Northwind has no open checks.'];
    render(<SessionAskLine sessionId={SESSION} />);
    askQuestion();
    await screen.findByText('The retry test timed out in ledger-core.');

    await act(async () => {
      await useAppStore
        .getState()
        .sendAskQuestion({ sessionId: SESSION, question: 'What about Northwind?', rightNow: [] });
    });

    screen.getByText('The retry test timed out in ledger-core.');
    expect(screen.queryByText('Northwind has no open checks.')).toBeNull();
  });

  it('never starts a turn for a question closed while the live work loads', async () => {
    let releaseLive: (rows: unknown) => void = () => undefined;
    tauri.liveWork = () =>
      new Promise((resolve) => {
        releaseLive = resolve;
      });
    render(<SessionAskLine sessionId={SESSION} />);
    askQuestion();
    fireEvent.click(screen.getByRole('button', { name: 'Close answer' }));

    await act(async () => {
      releaseLive([]);
    });

    expect(turn.questions).toEqual([]);
    expect(useAppStore.getState().askThreads[SESSION] ?? []).toEqual([]);
  });

  it('keeps Send off while the reply streams, and turns it on when the reply ends', async () => {
    const release = holdTurn({ texts: ['The retry test timed out in ledger-core.'] });
    render(<SessionAskLine sessionId={SESSION} />);
    askQuestion();
    await screen.findByText('The retry test timed out in ledger-core.');

    fireEvent.change(screen.getByRole('textbox', { name: 'Ask about this session' }), {
      target: { value: 'And the other check?' },
    });
    expect(screen.getByRole('button', { name: 'Send question' })).toHaveProperty('disabled', true);
    expect(screen.getByTestId('ask-line-answer').getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      release();
    });

    expect(screen.getByRole('button', { name: 'Send question' })).toHaveProperty('disabled', false);
  });
});
