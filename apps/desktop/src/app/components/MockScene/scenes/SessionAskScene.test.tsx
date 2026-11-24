// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import { currentPlatform } from '../../../../shared/platform';
import {
  activeAskBackend,
  registerAskBackend,
} from '../../../../features/session/ask/activeAskBackend';
import { SESSION } from './activityRunSeed';
import { SessionAskScene } from './SessionAskScene';
import { factCardOf } from '../../../../__tests__/helpers/factCard';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const renderState = async (state: string) => {
  window.history.replaceState(null, '', `/?scene=session-ask&state=${state}`);
  render(
    <ToastProvider>
      <SessionAskScene />
    </ToastProvider>,
  );
  return screen.findByRole('region', { name: 'Ask' });
};

const askPane = () => screen.getByRole('region', { name: 'Ask' });

const composerField = () => screen.getByRole('textbox', { name: 'Ask about this session' });

const HINT = 'Ask about this session. Read only, it starts nothing.';

describe('the session Ask scene', () => {
  it('opens as a pane with chips to try, one quiet hint and no Right now strip', async () => {
    await renderState('rightnow');
    const suggestions = within(screen.getByRole('group', { name: 'Try asking' }));
    expect(suggestions.getAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('ask-right-now')).toBeNull();
    expect(screen.getByPlaceholderText(HINT)).toBeDefined();
    expect(within(askPane()).queryByText('Read only')).toBeNull();
  });

  it('opens with no scope chip', async () => {
    await renderState('rightnow');
    expect(within(askPane()).queryByTestId('ask-scope')).toBeNull();
  });

  it('draws no explainer, and the hint turns into a follow up once a turn exists', async () => {
    await renderState('rightnow');
    expect(within(askPane()).queryByRole('heading', { name: 'Ask this session' })).toBeNull();
    expect(within(askPane()).queryByText(/What it did, what it found/)).toBeNull();
    cleanup();
    await renderState('answer');
    screen.getByPlaceholderText('Ask a follow up');
  });

  it('lists the earlier questions of the session in the Earlier menu and opens one', async () => {
    const showAskThread = vi.fn(async () => undefined);
    await renderState('answer');
    act(() => {
      useAppStore.setState({ showAskThread });
    });
    fireEvent.click(within(askPane()).getByRole('combobox', { name: 'Earlier questions' }));
    fireEvent.click(
      await screen.findByRole('option', { name: /Why did the first credit post twice\?/ }),
    );
    expect(showAskThread).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, threadId: 'mock-ask-thread-earlier' }),
    );
  });

  it('stays on the Overview until Ask is opened, then opens it as a pane beside the Overview', async () => {
    window.history.replaceState(null, '', '/?scene=session-ask&state=closed');
    render(
      <ToastProvider>
        <SessionAskScene />
      </ToastProvider>,
    );
    await screen.findByTestId('overview-title');
    expect(screen.queryByRole('region', { name: 'Ask' })).toBeNull();
    act(() => useAppStore.getState().openAsk({ sessionId: SESSION.id }));
    expect(await screen.findByRole('region', { name: 'Ask' })).toBeDefined();
    expect(useAppStore.getState().activeLens[SESSION.id] ?? null).toBeNull();
    expect(useAppStore.getState().drawer).toBeNull();
    screen.getByTestId('overview-title');
  });

  it('asks a suggested question at once', async () => {
    const sendAskQuestion = vi.fn(async () => true);
    await renderState('rightnow');
    act(() => {
      useAppStore.setState({ sendAskQuestion });
    });
    const suggestion = within(screen.getByRole('group', { name: 'Try asking' })).getAllByRole(
      'button',
    )[0];
    if (suggestion === undefined) {
      throw new Error('no suggested question');
    }
    fireEvent.click(suggestion);
    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION.id,
        question: suggestion.textContent,
      }),
    );
  });

  it('renders an answer with a bold first sentence, chips, buttons and the footer', async () => {
    await renderState('answer');
    const answer = await screen.findByTestId('ask-answer');
    expect(answer.querySelector('strong')?.textContent).toContain('One question is blocking');
    expect(within(answer).getAllByTestId('ask-chip').length).toBeGreaterThan(1);
    expect(screen.getByTestId('ask-footer').textContent).toMatch(/· 6s$/);
    expect(factCardOf({ element: screen.getByTestId('ask-footer') }).rows).toEqual([
      ['Cost', '$0.04'],
      ['Read', '2 files'],
    ]);
    expect(within(screen.getByTestId('ask-actions')).getByText(/^Answer: /)).toBeDefined();
  });

  it('opens the question a chip names beside the pane, and the answer stays', async () => {
    await renderState('answer');
    const answer = await screen.findByTestId('ask-answer');
    const questionChip = answer.querySelector<HTMLElement>('[data-ask-kind="question"] button');
    if (questionChip === null) {
      throw new Error('no question chip');
    }
    act(() => {
      fireEvent.click(questionChip);
    });
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'question',
      sessionId: SESSION.id,
    });
    expect(useAppStore.getState().askPaneOpen[SESSION.id]).toBe(true);
    act(() => {
      useAppStore.getState().closeQuestion();
    });
    expect(useAppStore.getState().askPaneOpen[SESSION.id]).toBe(true);
    screen.getByTestId('ask-answer');
  });

  it('prefills the answer field from the Answer button and never sends it', async () => {
    await renderState('answer');
    const button = within(await screen.findByTestId('ask-actions')).getByText(/^Answer: /);
    const questionId = useAppStore
      .getState()
      .sessionOpenQuestions[SESSION.id]?.find((question) => question.status === 'open')?.id;
    act(() => {
      fireEvent.click(button);
    });
    expect(useAppStore.getState().activeLens[SESSION.id]).toBe('questions');
    const { useOpenQuestions } =
      await import('../../../../features/context/components/QuestionsTab/useOpenQuestions');
    expect(useOpenQuestions.getState().drafts[questionId ?? '']?.customAnswer).toBe(
      'Stop after 5 attempts, then move the message to the dead-letter queue.',
    );
    expect(
      await screen.findByDisplayValue(
        'Stop after 5 attempts, then move the message to the dead-letter queue.',
      ),
    ).toBeDefined();
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'question',
      payload: { questionId },
    });
  });

  it('opens a plan from its chip in the plan panel, and the answer stays in the pane', async () => {
    await renderState('plan');
    await screen.findByTestId('ask-answer');
    await vi.waitFor(() =>
      expect(useAppStore.getState().drawer).toMatchObject({ kind: 'artifact-document' }),
    );
    expect(screen.queryByTestId('ask-plan')).toBeNull();
    screen.getByTestId('ask-answer');
    composerField();
  });

  it('folds the first question of a follow up to one line, opens it on Show answer, and hides the chips', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-answer');
    expect(screen.getAllByTestId('ask-turn')).toHaveLength(1);
    expect(screen.getAllByTestId('ask-folded-turn')).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Try asking' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the answer to What needs me?' }));
    expect(screen.getAllByTestId('ask-turn')).toHaveLength(2);
  });

  it('disables New question while a reply streams and enables it once idle', async () => {
    await renderState('streaming');
    const resetButton = within(askPane()).getByRole('button', { name: 'New question' });
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    await renderState('answer');
    const idleButton = within(askPane()).getByRole('button', { name: 'New question' });
    expect((idleButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('has no New button left in the header', async () => {
    await renderState('answer');
    expect(within(askPane()).queryByRole('button', { name: /^New$/ })).toBeNull();
  });

  it('New question empties the transcript and keeps the old chat under Earlier', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-turn');
    const before = useAppStore.getState().askThreadId[SESSION.id];
    expect(before).not.toBeNull();

    act(() => {
      fireEvent.click(within(askPane()).getByRole('button', { name: 'New question' }));
    });

    expect(useAppStore.getState().askThreadId[SESSION.id]).toBeNull();
    expect(screen.queryAllByTestId('ask-turn')).toHaveLength(0);
    screen.getByRole('group', { name: 'Try asking' });
    expect(
      useAppStore.getState().askThreads[SESSION.id]?.some((thread) => thread.id === before),
    ).toBe(true);
  });

  it('New question answers the chord from inside the pane, and only there', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-turn');
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);
    const isMac = currentPlatform() === 'darwin';
    const chord = { code: 'KeyN', metaKey: isMac, ctrlKey: !isMac };

    const composer = composerField();
    act(() => {
      composer.blur();
      fireEvent.keyDown(document.body, chord);
    });
    const callsOutside = newSession.mock.calls.length;
    const turnsOutside = screen.getAllByTestId('ask-turn').length;
    act(() => {
      composer.focus();
      fireEvent.keyDown(composer, chord);
    });
    stop();

    expect(callsOutside).toBe(0);
    expect(turnsOutside).toBe(1);

    expect(newSession).toHaveBeenCalledTimes(0);
    expect(useAppStore.getState().askThreadId[SESSION.id]).toBeNull();
    expect(screen.queryAllByTestId('ask-turn')).toHaveLength(0);
  });

  it('keeps the chord from starting a session while a reply streams', async () => {
    await renderState('streaming');
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);
    const isMac = currentPlatform() === 'darwin';
    const composer = composerField();
    const before = useAppStore.getState().askThreadId[SESSION.id];

    act(() => {
      composer.focus();
      fireEvent.keyDown(composer, { code: 'KeyN', metaKey: isMac, ctrlKey: !isMac });
    });
    stop();

    expect(newSession).not.toHaveBeenCalled();
    expect(useAppStore.getState().askThreadId[SESSION.id]).toBe(before);
  });

  it('streams an answer with the composer offering Stop', async () => {
    await renderState('streaming');
    expect(await screen.findByLabelText('Stop')).toBeDefined();
    expect(screen.queryByTestId('ask-footer')).toBeNull();
  });

  it('reports a Stop that failed and offers Stop again', async () => {
    const failure = new Error('the provider did not answer the cancel');
    const cancelTurn = activeAskBackend.cancelTurn;
    registerAskBackend({
      backend: { ...activeAskBackend, cancelTurn: () => Promise.reject(failure) },
    });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    try {
      await renderState('streaming');
      await act(async () => {
        fireEvent.click(await screen.findByLabelText('Stop'));
      });

      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't stop the reply", error: failure }),
      );
      expect(await screen.findByLabelText('Stop')).toBeDefined();
    } finally {
      registerAskBackend({ backend: { ...activeAskBackend, cancelTurn } });
    }
  });
});
