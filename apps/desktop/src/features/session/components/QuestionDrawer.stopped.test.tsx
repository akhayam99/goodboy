// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import type { OpenQuestionId, WorkflowOrchestrationStop } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { useOpenQuestions } from '../../context/components/QuestionsTab/useOpenQuestions';
import { OpenQuestionCluster } from '../../chat/components/ChatView/OpenQuestionCluster';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { BLOCKED_MOUNT_SESSION_ID } from '../../../app/components/MockScene/scenes/u30/blockedMountStepSeed';
import {
  STOPPED_FIRST_QUESTION_ID,
  seedStoppedQuestions,
} from '../../../app/components/MockScene/scenes/u33/stoppedQuestionsSeed';
import { QuestionDrawer } from './QuestionDrawer';

const SETTLE_MS = 2_000;
const PAUSED: WorkflowOrchestrationStop = { kind: 'paused', message: 'Paused from the run page' };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const stubSend = () => {
  const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
  useAppStore.setState({ sendTurn });
  return sendTurn;
};

describe('a stopped run question in the Needs you drawer', () => {
  it('reads read only with the stop hint and sends nothing', async () => {
    seedStoppedQuestions({ stop: PAUSED });
    const sendTurn = stubSend();
    const { container } = render(
      <ToastProvider>
        <QuestionDrawer
          sessionId={BLOCKED_MOUNT_SESSION_ID}
          questionId={STOPPED_FIRST_QUESTION_ID as OpenQuestionId}
          from={null}
          onClose={() => undefined}
        />
      </ToastProvider>,
    );
    await settle();
    const card = container.querySelector<HTMLElement>('[data-question-card]');
    if (card === null) {
      throw new Error('the drawer shows no question card');
    }

    const answer = within(card).getByRole('button', { name: 'Answer' });
    expect(answer).toHaveProperty('disabled', true);
    within(card)
      .getAllByRole('radio')
      .forEach((option) => expect(option.getAttribute('aria-disabled')).toBe('true'));
    const hint = within(card).getByText('Resume the run to answer');
    expect(card.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);

    await act(async () => {
      fireEvent.keyDown(card, { key: 'Enter' });
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });
});

describe('a stopped run question in the chat transcript', () => {
  it('reads read only with the stop hint and hides the key hint', async () => {
    seedStoppedQuestions({ stop: PAUSED });
    const questions = useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? [];
    const { container } = render(
      <ToastProvider>
        <OpenQuestionCluster questions={questions} sessionId={BLOCKED_MOUNT_SESSION_ID} />
      </ToastProvider>,
    );
    await settle();
    const card = container.querySelector<HTMLElement>('[data-question-card]');
    if (card === null) {
      throw new Error('the transcript shows no question card');
    }

    expect(within(card).getByRole('button', { name: 'Answer' })).toHaveProperty('disabled', true);
    within(card).getByText('Resume the run to answer');
    expect(within(card).queryByText('to pick')).toBeNull();
    expect(within(card).queryByText('to answer')).toBeNull();
  });

  it('answers again once the stop clears', async () => {
    seedStoppedQuestions({ stop: PAUSED });
    const questions = useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? [];
    const { container } = render(
      <ToastProvider>
        <OpenQuestionCluster questions={questions} sessionId={BLOCKED_MOUNT_SESSION_ID} />
      </ToastProvider>,
    );
    await settle();
    await act(async () => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          workflowRuns: session.workflowRuns.map(({ orchestrationStop: _stop, ...run }) => run),
        })),
      }));
    });
    await settle();
    const card = container.querySelector<HTMLElement>('[data-question-card]');

    expect(card?.querySelector('[role="radio"]')?.getAttribute('aria-disabled')).not.toBe('true');
    expect(within(card as HTMLElement).queryByText('Resume the run to answer')).toBeNull();
  });
});
