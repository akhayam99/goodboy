// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenQuestion, WorkflowOrchestrationStop } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { BLOCKED_MOUNT_AGENT_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { seedStoppedQuestions } from './stoppedQuestionsSeed';

type StopCase = {
  readonly kind: WorkflowOrchestrationStop['kind'];
  readonly hint: string;
};

const STOP_CASES: ReadonlyArray<StopCase> = [
  { kind: 'budget', hint: 'Raise the limit to answer' },
  { kind: 'failure', hint: 'Retry the run to answer' },
  { kind: 'operator', hint: 'Continue the run to answer' },
  { kind: 'needs-approval', hint: 'Approve to answer' },
  { kind: 'paused', hint: 'Resume the run to answer' },
  { kind: 'preset-change', hint: 'Decide on the preset to answer' },
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

const firstQuestion = (): OpenQuestion => {
  const question = (useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? [])[0];
  if (question === undefined) {
    throw new Error('the seed holds no question');
  }
  return question;
};

const stubSend = () => {
  const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
  useAppStore.setState({ sendTurn });
  return sendTurn;
};

describe('a stopped run refuses answers in the store', () => {
  it.each(STOP_CASES)('rejects answerOpenQuestions on the $kind stop', async ({ kind, hint }) => {
    seedStoppedQuestions({ stop: { kind, message: 'stopped' } });
    const sendTurn = stubSend();
    const question = firstQuestion();

    await expect(
      useAppStore
        .getState()
        .answerOpenQuestions(
          BLOCKED_MOUNT_SESSION_ID,
          [{ id: question.id, text: question.text, answer: 'Batch them' }],
          BLOCKED_MOUNT_AGENT_ID,
        ),
    ).rejects.toThrow(hint);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(
      (useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? []).map(
        (candidate) => candidate.status,
      ),
    ).toEqual(['open', 'open']);
  });

  it.each(STOP_CASES)('refuses send as message on the $kind stop', async ({ kind }) => {
    seedStoppedQuestions({ stop: { kind, message: 'stopped' } });
    const sendTurn = stubSend();

    const isSent = await useAppStore.getState().sendQuestionAsMessage({
      sessionId: BLOCKED_MOUNT_SESSION_ID,
      question: firstQuestion(),
      text: 'Batch them',
    });

    expect(isSent).toBe(false);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('refuses to delegate a stopped run question', async () => {
    seedStoppedQuestions({ stop: { kind: 'paused', message: 'stopped' } });
    const spawnAgent = vi.fn(async () => BLOCKED_MOUNT_AGENT_ID);
    useAppStore.setState({ spawnAgent });

    const outcomes = await useAppStore.getState().spawnQuestionDelegates({
      sessionId: BLOCKED_MOUNT_SESSION_ID,
      requests: [
        { question: firstQuestion(), hints: '', provider: '', model: 'm', effort: 'medium' },
      ],
    });

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['refused']);
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
