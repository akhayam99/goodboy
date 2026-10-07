// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import type { Session, SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  seedColumn,
  sessionOf,
  runningState,
} from '../../../features/workspace/testing/sessionColumn';
import { useSessionStageInfo } from './selectors';
import { stageInfoOf } from './stageInfoOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const held = (id: string): WorkflowRun =>
  aWorkflowRun({
    id: id as WorkflowRunId,
    orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  });

const seeded = ({ session }: { readonly session: Session }): Session => {
  seedColumn({
    store: useAppStore,
    sessions: [session],
    currentSessionId: session.id as SessionId,
  });
  return useAppStore.getState().sessions[0] as Session;
};

const infoOf = (session: Session) => stageInfoOf(useAppStore.getState(), session);

describe('stageInfoOf and a plan that waits for approval', () => {
  it('gives plan-approval to a session whose run stopped for the plan', () => {
    const session = seeded({
      session: { ...sessionOf({ goal: 'Retry webhooks' }), workflowRuns: [held('run-held')] },
    });

    expect(infoOf(session)).toMatchObject({
      stage: 'attention',
      attention: 'plan-approval',
      isRunning: false,
      otherReasons: [],
    });
  });

  it('keeps a session in needs you, still running, while another agent works', () => {
    const session = seeded({
      session: {
        ...sessionOf({ goal: 'Retry webhooks', state: runningState() }),
        workflowRuns: [held('run-held')],
      },
    });

    expect(infoOf(session)).toMatchObject({
      stage: 'attention',
      attention: 'plan-approval',
      isRunning: true,
    });
  });

  it('does not count a run that was archived or one stopped for another reason', () => {
    const archived = { ...held('run-archived'), discardedAt: '2026-10-06T08:00:00.000Z' };
    const paused = aWorkflowRun({
      id: 'run-paused' as WorkflowRunId,
      orchestrationStop: { kind: 'paused', message: 'Paused.' },
    });
    const session = seeded({
      session: {
        ...sessionOf({ goal: 'Retry webhooks' }),
        workflowRuns: [archived as WorkflowRun, paused],
      },
    });

    expect(infoOf(session).attention).toBeNull();
  });

  it('lists the held plan next to the facts that rank below it', () => {
    const session = seeded({
      session: { ...sessionOf({ goal: 'Retry webhooks' }), workflowRuns: [held('run-held')] },
    });
    useAppStore.setState({
      sessionOpenQuestions: {
        [session.id]: [
          {
            id: 'question-one' as never,
            sessionId: session.id as SessionId,
            text: 'Which window?',
            suggestedAnswers: [],
            isBlocking: true,
            userAnswer: null,
            status: 'open',
            createdAt: '2026-10-05T09:00:00.000Z' as never,
          },
        ],
      },
    });

    expect(infoOf(session)).toMatchObject({
      attention: 'plan-approval',
      otherReasons: ['open-question'],
      openQuestionCount: 1,
    });
  });
});

describe('useSessionStageInfo', () => {
  it('hands back the same info while nothing that decides the stage changes', () => {
    const session = seeded({
      session: { ...sessionOf({ goal: 'Retry webhooks' }), workflowRuns: [held('run-held')] },
    });
    useAppStore.setState({
      sessionGithub: {
        [session.id]: {
          pr: {
            number: 318,
            title: 'Retry webhooks',
            url: 'https://github.com/harborline/payments-api/pull/318',
            state: 'approved',
            mergeable: null,
            checks: 'failure',
            baseBranch: 'main',
            headBranch: 'goodboy/retry',
            isDraft: false,
            reviewDecision: 'approved',
            body: '',
            updatedAt: '2026-10-06T09:00:00.000Z',
          },
          linkedIssues: [],
          fetchedAt: null,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
        },
      },
    });
    const { result } = renderHook(() => useSessionStageInfo(session));
    const first = result.current;

    expect(first.otherReasons).toEqual(['ci-failed', 'pr-approved']);
    act(() => {
      useAppStore.setState({ settings: { ...useAppStore.getState().settings } });
    });
    expect(result.current).toBe(first);
  });
});
