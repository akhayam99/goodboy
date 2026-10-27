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
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  brandId,
  type StepId,
  type IntegrationDraft,
  type IntegrationDraftId,
  type IsoDateTime,
  type Session,
  type SessionId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  at,
  mergedGithub,
  openQuestionFor,
  runningState,
  harborline,
  seedColumn,
  sessionOf,
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
  return session;
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
    const archived = aWorkflowRun({
      id: 'run-archived' as WorkflowRunId,
      orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      discardedAt: at('2026-10-06T08:00:00.000Z'),
    });
    const paused = aWorkflowRun({
      id: 'run-paused' as WorkflowRunId,
      orchestrationStop: { kind: 'paused', message: 'Paused.' },
    });
    const session = seeded({
      session: { ...sessionOf({ goal: 'Retry webhooks' }), workflowRuns: [archived, paused] },
    });

    expect(infoOf(session).attention).toBeNull();
  });

  it('lists the held plan next to the facts that rank below it', () => {
    const session = seeded({
      session: { ...sessionOf({ goal: 'Retry webhooks' }), workflowRuns: [held('run-held')] },
    });
    useAppStore.setState({
      sessionOpenQuestions: {
        [session.id]: [openQuestionFor({ sessionId: session.id as SessionId })],
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
    const github = mergedGithub();
    useAppStore.setState({
      sessionGithub: {
        [session.id]: {
          ...github,
          pr:
            github.pr === null
              ? null
              : {
                  ...github.pr,
                  state: 'approved',
                  checks: 'failure',
                  reviewDecision: 'approved',
                },
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

const RELEASE_ID = brandId<WorkflowId>({ value: 'workflow-release' });

const releaseWorkflow = (): Workflow => ({
  id: RELEASE_ID,
  workspaceId: harborline.id,
  name: 'Release checklist',
  description: '',
  steps: [],
  createdAt: at('2026-10-01T09:00:00.000Z'),
  updatedAt: at('2026-10-01T09:00:00.000Z'),
});

const stoppedRun = (id: string, stop: WorkflowRun['orchestrationStop']): WorkflowRun =>
  aWorkflowRun({
    id: brandId<WorkflowRunId>({ value: id }),
    workflowId: RELEASE_ID,
    executionMode: 'dynamic',
    ...(stop === undefined ? {} : { orchestrationStop: stop }),
  });

const seededWithRun = ({ run }: { readonly run: WorkflowRun }): Session => {
  const session = seeded({
    session: { ...sessionOf({ goal: 'Roll out the Northwind release' }), workflowRuns: [run] },
  });
  useAppStore.setState({ sessionWorkflows: { [session.id]: [releaseWorkflow()] } });
  return session;
};

describe('stageInfoOf and the waits the registry lifts', () => {
  it('lifts a run that stopped on a failure, in danger, above the lanes', () => {
    const session = seededWithRun({
      run: stoppedRun('run-stopped', { kind: 'failure', message: 'The orchestrator failed.' }),
    });

    expect(infoOf(session)).toMatchObject({
      stage: 'attention',
      attention: 'run-stopped',
      isRunning: false,
    });
  });

  it('lifts a run that paused at its limit', () => {
    const session = seededWithRun({
      run: stoppedRun('run-limited', { kind: 'budget', message: 'Limit.' }),
    });

    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'run-paused-at-limit' });
  });

  it('lifts a run that waits for Continue once its step finished', () => {
    const session = seededWithRun({ run: stoppedRun('run-go', undefined) });
    useAppStore.setState({
      sessionPhaseRuns: {
        [session.id]: [
          anAgent({
            sessionId: session.id,
            status: 'completed',
            workflowRunId: brandId<WorkflowRunId>({ value: 'run-go' }),
            stepId: brandId<StepId>({ value: 'step-1' }),
          }),
        ],
      },
    });

    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'run-waits-for-go' });
  });

  it('lifts a Slack reply that waits under Ask first, and drops it once sent', () => {
    const session = seeded({ session: sessionOf({ goal: 'Answer the Acme thread' }) });
    const draft = (status: IntegrationDraft['status']): IntegrationDraft => ({
      id: brandId<IntegrationDraftId>({ value: 'draft-1' }),
      workspaceId: harborline.id,
      sessionId: session.id,
      provider: 'slack',
      verb: 'reply',
      target: {},
      body: 'On it.',
      status,
      createdAt: at('2026-10-06T09:00:00.000Z'),
      updatedAt: at('2026-10-06T09:00:00.000Z'),
      decidedAt: null,
    });

    useAppStore.setState({ sessionSlackDrafts: { [session.id]: [draft('pending')] } });
    expect(infoOf(session)).toMatchObject({
      stage: 'attention',
      attention: 'slack-reply-waiting',
      attentionSince: Date.parse('2026-10-06T09:00:00.000Z'),
    });

    useAppStore.setState({ sessionSlackDrafts: { [session.id]: [draft('sent')] } });
    expect(infoOf(session).attention).toBeNull();
  });

  it('puts the question that waited longest first, with the time it was asked', () => {
    const session = seeded({ session: sessionOf({ goal: 'Retry webhooks' }) });
    useAppStore.setState({
      sessionOpenQuestions: {
        [session.id]: [openQuestionFor({ sessionId: session.id })],
      },
    });

    expect(infoOf(session)).toMatchObject({
      attention: 'open-question',
      attentionSince: Date.parse('2026-10-05T09:00:00.000Z'),
    });
  });
});

describe('stageInfoOf and a suggestion put away with Not now', () => {
  const failingChecks = (session: Session) => {
    const github = mergedGithub();
    useAppStore.setState({
      sessionGithub: {
        [session.id]: {
          ...github,
          pr:
            github.pr === null
              ? null
              : { ...github.pr, number: 318, state: 'open', checks: 'failure' },
        },
      },
    });
  };

  it('keeps failing checks in needs you until Fix failing checks is put away', () => {
    const session = seeded({ session: sessionOf({ goal: 'Retry webhooks' }) });
    failingChecks(session);

    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'ci-failed' });
  });

  it('moves the session to in review while the deferral holds, and back when it ends', () => {
    const session = seeded({ session: sessionOf({ goal: 'Retry webhooks' }) });
    failingChecks(session);
    const id = session.id;

    useAppStore.getState().setSessionDismissedNextSteps({
      sessionId: id,
      fingerprints: new Set(['fix-checks:mount-1:318']),
    });
    expect(infoOf(session)).toMatchObject({ stage: 'review', attention: null });

    useAppStore.getState().setSessionDismissedNextSteps({ sessionId: id, fingerprints: new Set() });
    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'ci-failed' });
  });

  it('does not defer a question, whatever was put away', () => {
    const session = seeded({ session: sessionOf({ goal: 'Retry webhooks' }) });
    failingChecks(session);
    const id = session.id;
    useAppStore.setState({
      sessionOpenQuestions: { [session.id]: [openQuestionFor({ sessionId: id })] },
    });
    useAppStore.getState().setSessionDismissedNextSteps({
      sessionId: id,
      fingerprints: new Set(['fix-checks:mount-1:318', `answer-questions:${id}:1`]),
    });

    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'open-question' });
  });
});

describe('stageInfoOf and work that never opens a pull request', () => {
  const FINISHED_AT = '2026-10-07T09:00:00.000Z';

  type SettledParams = {
    readonly kind: string;
    readonly isViewed?: boolean;
  };

  const settled = ({ kind, isViewed = true }: SettledParams): Session => {
    const session = seeded({ session: sessionOf({ goal: 'Where do retries live' }) });
    useAppStore.setState({
      sessionBranches: { [session.id]: '' },
      sessionPhaseRuns: {
        [session.id]: [
          anAgent({
            sessionId: brandId<SessionId>({ value: session.id }),
            kind,
            status: 'completed',
            lastFinishedAt: at(FINISHED_AT),
            ...(isViewed && { lastViewedAt: at('2026-10-07T09:05:00.000Z') }),
          }),
        ],
      },
    });
    return session;
  };

  it('reads a Scout answer with no mount as done, answered', () => {
    expect(infoOf(settled({ kind: 'scout' }))).toMatchObject({
      stage: 'done',
      reason: 'answered',
      attention: null,
    });
  });

  it('keeps the answer in needs you until it is read, then done', () => {
    const session = settled({ kind: 'scout', isViewed: false });

    expect(infoOf(session)).toMatchObject({ stage: 'attention', attention: 'unread-reply' });

    useAppStore.setState({
      sessionPhaseRuns: {
        [session.id]: (useAppStore.getState().sessionPhaseRuns[session.id] ?? []).map((agent) => ({
          ...agent,
          lastViewedAt: at('2026-10-07T09:05:00.000Z'),
        })),
      },
    });

    expect(infoOf(session)).toMatchObject({ stage: 'done', reason: 'answered' });
  });

  it('reads the plan or the report the agent left in the reason', () => {
    const session = settled({ kind: 'planner' });
    useAppStore.setState({
      sessionArtifacts: {
        [session.id]: [
          JSON.parse(JSON.stringify({ kind: 'plan', status: 'active', metadata: {} })),
        ],
      },
    });

    expect(infoOf(session)).toMatchObject({ stage: 'done', reason: 'plan ready' });

    useAppStore.setState({
      sessionArtifacts: {
        [session.id]: [
          JSON.parse(JSON.stringify({ kind: 'report', status: 'active', metadata: {} })),
        ],
      },
    });

    expect(infoOf(session)).toMatchObject({ stage: 'done', reason: 'report ready' });
  });

  it('reopens to running when the person writes again and an agent works', () => {
    const session = settled({ kind: 'scout' });
    useAppStore.setState({
      agentTurnState: {
        [useAppStore.getState().sessionPhaseRuns[session.id]?.[0]?.id ?? '']: runningState(),
      },
    });

    expect(infoOf(session).stage).toBe('running');
  });

  it('leaves a writer on a mounted project to its pull request', () => {
    const session = settled({ kind: 'implementer' });
    useAppStore.setState({ sessionBranches: { [session.id]: 'hl/retry-limits' } });

    expect(infoOf(session)).toMatchObject({ stage: 'building' });
  });
});
