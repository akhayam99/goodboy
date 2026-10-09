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
import { SESSION } from './activityRunSeed';
import { SessionAskScene } from './SessionAskScene';

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
  return screen.findByTestId('ask-trail-button');
};

const askDrawer = () => screen.getByRole('region', { name: 'Ask' });

describe('the session Ask scene', () => {
  it('opens from the trail band and shows Right now with no model call', async () => {
    const trigger = await renderState('rightnow');
    expect(trigger.getAttribute('aria-pressed')).toBe('true');
    const rightNow = within(screen.getByTestId('ask-right-now'));
    expect(rightNow.queryByText('instant, no model')).toBeNull();
    expect(rightNow.getByText(/in this session$/)).toBeDefined();
    expect(rightNow.getByText('Try asking')).toBeDefined();
    expect(screen.getByPlaceholderText('Ask about this session…')).toBeDefined();
    expect(within(askDrawer()).getByText('Read-only')).toBeDefined();
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

  it('asks a suggested question with the Right now lines', async () => {
    const sendAskQuestion = vi.fn(async () => true);
    await renderState('rightnow');
    act(() => {
      useAppStore.setState({ sendAskQuestion });
    });
    const suggestion = within(screen.getByTestId('ask-right-now')).getAllByRole('button')[0];
    if (suggestion === undefined) {
      throw new Error('no suggested question');
    }
    fireEvent.click(suggestion);
    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION.id,
        question: suggestion.textContent,
        rightNow: expect.arrayContaining([expect.stringMatching(/in this session$/)]),
      }),
    );
  });

  it('renders an answer with a bold first sentence, chips, buttons and the footer', async () => {
    await renderState('answer');
    const answer = await screen.findByTestId('ask-answer');
    expect(answer.querySelector('strong')?.textContent).toContain('One question is blocking');
    expect(within(answer).getAllByTestId('ask-chip').length).toBeGreaterThan(1);
    expect(screen.getByTestId('ask-footer').textContent).toMatch(/· 6s · \$0\.04 · read 2 files$/);
    expect(within(screen.getByTestId('ask-actions')).getByText('Answer question 1')).toBeDefined();
  });

  it('moves the page beside it when a chip is clicked, and Ask stays open', async () => {
    await renderState('answer');
    const answer = await screen.findByTestId('ask-answer');
    const questionChip = answer.querySelector<HTMLElement>('[data-ask-kind="question"] button');
    if (questionChip === null) {
      throw new Error('no question chip');
    }
    expect(screen.getByTestId('context-chip')).toBeDefined();
    act(() => {
      fireEvent.click(questionChip);
    });
    expect(useAppStore.getState().activeLens[SESSION.id]).toBe('questions');
    expect(screen.queryByTestId('context-chip')).toBeNull();
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

  it('shows a follow-up as a second turn in the same thread and folds Right now', async () => {
    await renderState('followup');
    await screen.findAllByTestId('ask-answer');
    expect(screen.getAllByTestId('ask-turn')).toHaveLength(2);
    expect(screen.queryByTestId('ask-right-now')).toBeNull();
    expect(within(askDrawer()).getByRole('button', { name: /Right now/ })).toBeDefined();
  });

  it('disables New while a reply streams and enables it once idle', async () => {
    await renderState('streaming');
    const newButton = within(askDrawer()).getByRole('button', { name: /New/ });
    expect((newButton as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    await renderState('answer');
    const idleButton = within(askDrawer()).getByRole('button', { name: /New/ });
    expect((idleButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('streams an answer with the composer offering Stop', async () => {
    await renderState('streaming');
    expect(await screen.findByLabelText('Stop the answer')).toBeDefined();
    expect(screen.queryByTestId('ask-footer')).toBeNull();
  });
});
