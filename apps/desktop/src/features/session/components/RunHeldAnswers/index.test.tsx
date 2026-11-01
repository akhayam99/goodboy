// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
  type WorkflowOrchestrationStop,
  type WorkflowRunId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { RunHeldAnswers } from '.';

const SESSION_ID = brandId<SessionId>({ value: 'session-refunds' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-refunds' });
const BUDGET_STOP: WorkflowOrchestrationStop = { kind: 'budget', message: 'Paused at the limit' };

type AnsweredParams = {
  readonly id: string;
  readonly isDelivered: boolean;
};

const answered = ({ id, isDelivered }: AnsweredParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  text: 'Should refunds older than 90 days be batched?',
  suggestedAnswers: [],
  selectMode: 'one',
  isBlocking: true,
  userAnswer: 'Batch them',
  status: 'answered',
  ...(isDelivered && {
    answerDeliveredAt: brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' }),
  }),
  createdAt: brandId<IsoDateTime>({ value: '2026-11-01T08:00:00.000Z' }),
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  useAppStore.setState({
    sessionAnsweredQuestions: {
      [SESSION_ID]: [
        answered({ id: 'q-1', isDelivered: false }),
        answered({ id: 'q-2', isDelivered: true }),
      ],
    },
  });
});

afterEach(cleanup);

describe('RunHeldAnswers', () => {
  it('says how many answers wait for resume on a stopped run', () => {
    const view = render(
      <RunHeldAnswers
        sessionId={SESSION_ID}
        run={{ id: RUN_ID, orchestrationStop: BUDGET_STOP }}
      />,
    );

    expect(view.container.textContent).toBe('1 answer waits for resume');
  });

  it('follows the store when another answer is held, and goes quiet when it is delivered', async () => {
    const view = render(
      <RunHeldAnswers
        sessionId={SESSION_ID}
        run={{ id: RUN_ID, orchestrationStop: BUDGET_STOP }}
      />,
    );

    await act(async () => {
      useAppStore.setState({
        sessionAnsweredQuestions: {
          [SESSION_ID]: [
            answered({ id: 'q-1', isDelivered: false }),
            answered({ id: 'q-3', isDelivered: false }),
          ],
        },
      });
    });
    expect(view.container.textContent).toBe('2 answers wait for resume');

    await act(async () => {
      useAppStore.setState({
        sessionAnsweredQuestions: { [SESSION_ID]: [answered({ id: 'q-1', isDelivered: true })] },
      });
    });
    expect(view.container.textContent).toBe('');
  });

  it('shows nothing on a run that is not stopped', () => {
    const view = render(<RunHeldAnswers sessionId={SESSION_ID} run={{ id: RUN_ID }} />);

    expect(view.container.textContent).toBe('');
  });
});
