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
import { requestAskReset } from '../../../../features/session/ask/requestAskReset';
import { SESSION } from './activityRunSeed';
import { SessionAskScene } from './SessionAskScene';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';

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
  return screen.findByTestId('pane-toggle-ask');
};

const askDrawer = () => screen.getByRole('region', { name: 'Ask' });

describe('the session Ask scene', () => {
  it('opens from the trail band with questions to try and no Right now strip', async () => {
    const trigger = await renderState('rightnow');
    expect(trigger.getAttribute('aria-pressed')).toBe('true');
    const suggestions = within(screen.getByRole('region', { name: 'Try asking' }));
    expect(suggestions.getAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('ask-right-now')).toBeNull();
    expect(screen.getByPlaceholderText('Ask about this session…')).toBeDefined();
    expect(within(askDrawer()).getByText('Read only')).toBeDefined();
  });

  it('closes and reopens from the trail button', async () => {
    const trigger = await renderState('closed');
    expect(trigger.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Ask' })).toBeNull();
    fireEvent.click(trigger);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'ask',
      sessionId: SESSION.id,
      payload: null,
    });
    fireEvent.click(trigger);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('asks a suggested question', async () => {
    const sendAskQuestion = vi.fn(async () => true);
    await renderState('rightnow');
    act(() => {
      useAppStore.setState({ sendAskQuestion });
    });
    const suggestion = within(screen.getByRole('region', { name: 'Try asking' })).getAllByRole(
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
    expect(tooltipTextOf({ element: screen.getByTestId('ask-footer') })).toBe(
      '$0.04 · read 2 files',
    );
    expect(within(screen.getByTestId('ask-actions')).getByText('Answer question 1')).toBeDefined();
  });

  it('moves the page beside it when a chip is clicked, and Ask stays open', async () => {
    await renderState('answer');
    const answer = await screen.findByTestId('ask-answer');
    const questionChip = answer.querySelector<HTMLElement>('[data-ask-kind="question"] button');
    if (questionChip === null) {
      throw new Error('no question chip');
    }
    expect(screen.getByTestId('overview-title')).toBeDefined();
    act(() => {
      fireEvent.click(questionChip);
    });
    expect(useAppStore.getState().activeLens[SESSION.id]).toBe('questions');
    expect(screen.queryByTestId('overview-title')).toBeNull();
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'ask', sessionId: SESSION.id });
    expect(askDrawer()).toBeDefined();
  });

  it('prefills the answer field from Answer question 1 and never sends it', async () => {
    await renderState('answer');
    const button = within(await screen.findByTestId('ask-actions')).getByText('Answer question 1');
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
    expect(useOpenQuestions.getState().focusedQuestionId).toBeNull();
    expect(
      await screen.findByDisplayValue(
        'Stop after 5 attempts, then move the message to the dead-letter queue.',
      ),
    ).toBeDefined();
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'ask' });
  });

  it('opens a plan inside Ask under Back to answer, and Esc goes back', async () => {
    await renderState('plan');
    const plan = await screen.findByTestId('ask-plan');
    expect(within(plan).getByText('Back to answer')).toBeDefined();
    expect(screen.queryByPlaceholderText('Ask about this session…')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByTestId('ask-answer')).toBeDefined();
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'ask' });
  });

  it('a palette reset inside a plan restores the composer', async () => {
    await renderState('plan');
    await screen.findByTestId('ask-plan');
    expect(screen.queryByPlaceholderText('Ask about this session…')).toBeNull();
    act(() => {
      requestAskReset({ sessionId: SESSION.id });
    });
    expect(await screen.findByPlaceholderText('Ask about this session…')).toBeDefined();
    expect(screen.queryByTestId('ask-plan')).toBeNull();
  });

  it('shows a follow-up as a second turn in the same thread and hides the questions to try', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-answer');
    expect(screen.getAllByTestId('ask-turn')).toHaveLength(2);
    expect(screen.queryByRole('region', { name: 'Try asking' })).toBeNull();
  });

  it('disables Reset chat while a reply streams and enables it once idle', async () => {
    await renderState('streaming');
    const resetButton = within(askDrawer()).getByRole('button', { name: 'Reset chat' });
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    await renderState('answer');
    const idleButton = within(askDrawer()).getByRole('button', { name: 'Reset chat' });
    expect((idleButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('has no New button left in the header', async () => {
    await renderState('answer');
    expect(within(askDrawer()).queryByRole('button', { name: /^New$/ })).toBeNull();
  });

  it('Reset chat empties the transcript and keeps the old chat under Earlier', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-turn');
    const before = useAppStore.getState().askThreadId[SESSION.id];
    expect(before).not.toBeNull();

    act(() => {
      fireEvent.click(within(askDrawer()).getByRole('button', { name: 'Reset chat' }));
    });

    expect(useAppStore.getState().askThreadId[SESSION.id]).toBeNull();
    expect(screen.queryAllByTestId('ask-turn')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Try asking' })).toBeDefined();
    expect(
      useAppStore.getState().askThreads[SESSION.id]?.some((thread) => thread.id === before),
    ).toBe(true);
  });

  it('Reset chat answers the chord from inside the panel, and only there', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-turn');
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);
    const isMac = currentPlatform() === 'darwin';
    const chord = { code: 'KeyN', metaKey: isMac, ctrlKey: !isMac };

    const composer = screen.getByPlaceholderText('Ask about this session…');
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

    expect(callsOutside).toBe(1);
    expect(turnsOutside).toBe(2);

    expect(newSession).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().askThreadId[SESSION.id]).toBeNull();
    expect(screen.queryAllByTestId('ask-turn')).toHaveLength(0);
  });

  it('keeps the chord from starting a session while a reply streams', async () => {
    await renderState('streaming');
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);
    const isMac = currentPlatform() === 'darwin';
    const composer = screen.getByPlaceholderText('Ask about this session…');
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
    expect(await screen.findByLabelText('Stop the answer')).toBeDefined();
    expect(screen.queryByTestId('ask-footer')).toBeNull();
  });
});
