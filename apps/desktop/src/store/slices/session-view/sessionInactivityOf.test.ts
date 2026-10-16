// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionAttentionReason,
  TurnState,
  WorkflowRun,
  WorkflowRunId,
  WorkflowId,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { sessionInactivityOf } from './sessionInactivityOf';
import { INACTIVE_AFTER_MS, RECENTLY_OPENED_MS } from './types';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type AgoParams = {
  readonly ms: number;
};

const ago = ({ ms }: AgoParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(NOW - ms).toISOString() });

type InactivityStageInfo = Parameters<typeof sessionInactivityOf>[0]['info'];

const QUIET: InactivityStageInfo = {
  stage: 'building',
  attention: null,
  otherReasons: [],
  isRunning: false,
};

type SessionParams = {
  readonly lastActivityMs?: number;
  readonly openedMs?: number;
  readonly state?: TurnState;
  readonly workflowRuns?: ReadonlyArray<WorkflowRun>;
};

const sessionOf = ({
  lastActivityMs = 5 * DAY_MS,
  openedMs,
  state,
  workflowRuns = [],
}: SessionParams = {}): Session =>
  aSession({
    goal: 'Reconcile the ledger export',
    createdAt: ago({ ms: 30 * DAY_MS }),
    updatedAt: ago({ ms: lastActivityMs }),
    state: state ?? { kind: 'idle', lastActivityAt: ago({ ms: lastActivityMs }) },
    workflowRuns,
    ...(openedMs === undefined ? {} : { lastOpenedAt: ago({ ms: openedMs }) }),
  });

type DecideParams = {
  readonly session?: Session;
  readonly info?: InactivityStageInfo;
  readonly now?: number;
  readonly isPinned?: boolean;
  readonly isCurrent?: boolean;
  readonly isQueued?: boolean;
  readonly hasDraft?: boolean;
  readonly seenActivityAt?: number | null;
};

const decide = ({
  session = sessionOf(),
  info = QUIET,
  now = NOW,
  isPinned = false,
  isCurrent = false,
  isQueued = false,
  hasDraft = false,
  seenActivityAt = null,
}: DecideParams = {}) =>
  sessionInactivityOf({
    session,
    info,
    now,
    isPinned,
    isCurrent,
    isQueued,
    hasDraft,
    seenActivityAt,
  });

const runOf = ({ createdMs, hintMs }: { readonly createdMs: number; readonly hintMs?: number }) =>
  ({
    id: brandId<WorkflowRunId>({ value: 'run-ledger' }),
    workflowId: brandId<WorkflowId>({ value: 'workflow-ledger' }),
    ordinal: 1,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'static',
    createdAt: ago({ ms: createdMs }),
    ...(hintMs === undefined
      ? {}
      : {
          orchestratorHints: [
            { id: 'hint-1', text: 'Use the queue', createdAt: ago({ ms: hintMs }) },
          ],
        }),
  }) satisfies WorkflowRun;

describe('sessionInactivityOf', () => {
  it('calls a quiet session inactive once its last activity is older than three days', () => {
    const result = decide();

    expect(result).toEqual({ isInactive: true, lastActivityAt: NOW - 5 * DAY_MS });
  });

  it('keeps a session active at exactly the threshold and moves it one millisecond later', () => {
    const session = sessionOf({ lastActivityMs: INACTIVE_AFTER_MS });

    expect(decide({ session }).isInactive).toBe(false);
    expect(decide({ session, now: NOW + 1 }).isInactive).toBe(true);
  });

  it('never calls a session with a stamp in the future inactive', () => {
    const session = sessionOf({ lastActivityMs: -DAY_MS });

    expect(decide({ session })).toEqual({ isInactive: false, lastActivityAt: NOW + DAY_MS });
  });

  it('keeps a pinned session active', () => {
    expect(decide({ isPinned: true }).isInactive).toBe(false);
  });

  it('keeps the open session active', () => {
    expect(decide({ isCurrent: true }).isInactive).toBe(false);
  });

  it('keeps a session with a queued message active', () => {
    expect(decide({ isQueued: true }).isInactive).toBe(false);
  });

  it('keeps a session with an unsent draft active', () => {
    expect(decide({ hasDraft: true }).isInactive).toBe(false);
  });

  it('keeps a session active while an agent runs', () => {
    expect(decide({ info: { ...QUIET, stage: 'running', isRunning: true } }).isInactive).toBe(
      false,
    );
    expect(decide({ info: { ...QUIET, isRunning: true } }).isInactive).toBe(false);
  });

  it.each<TurnState>([
    { kind: 'starting', startedAt: ago({ ms: 5 * DAY_MS }) },
    {
      kind: 'running',
      runId: brandId<ProviderRunId>({ value: 'run-1' }),
      startedAt: ago({ ms: 5 * DAY_MS }),
    },
    {
      kind: 'blocked',
      runId: brandId<ProviderRunId>({ value: 'run-1' }),
      blockedAt: ago({ ms: 5 * DAY_MS }),
    },
    { kind: 'error', message: 'The agent stopped', failedAt: ago({ ms: 5 * DAY_MS }) },
  ])('keeps a session whose own state is $kind active', (state) => {
    expect(decide({ session: sessionOf({ state }) }).isInactive).toBe(false);
  });

  it.each<SessionAttentionReason>([
    'needs-approval',
    'agent-error',
    'plan-approval',
    'open-question',
    'fix-needs-you',
    'ci-failed',
    'unread-reply',
    'pr-approved',
  ])('keeps a session that needs you for %s active', (reason) => {
    expect(decide({ info: { ...QUIET, stage: 'attention', attention: reason } }).isInactive).toBe(
      false,
    );
  });

  it('keeps a session waiting in the merge queue active', () => {
    expect(decide({ info: { ...QUIET, stage: 'review', attention: 'pr-queued' } }).isInactive).toBe(
      false,
    );
  });

  it('keeps a session with a second reason such as an unread reply active', () => {
    expect(decide({ info: { ...QUIET, otherReasons: ['unread-reply'] } }).isInactive).toBe(false);
  });

  it('lets a quiet session in review or done go inactive', () => {
    expect(decide({ info: { ...QUIET, stage: 'review' } }).isInactive).toBe(true);
    expect(decide({ info: { ...QUIET, stage: 'done' } }).isInactive).toBe(true);
  });

  it('keeps a session opened in the last day active, and lets it go once the day and the threshold pass', () => {
    expect(decide({ session: sessionOf({ openedMs: RECENTLY_OPENED_MS }) }).isInactive).toBe(false);
    expect(decide({ session: sessionOf({ openedMs: 4 * DAY_MS }) })).toEqual({
      isInactive: true,
      lastActivityAt: NOW - 4 * DAY_MS,
    });
  });

  it('counts the latest agent turn, run step or pull request event it saw', () => {
    expect(decide({ seenActivityAt: NOW - DAY_MS })).toEqual({
      isInactive: false,
      lastActivityAt: NOW - DAY_MS,
    });
  });

  it('counts a run started or a hint sent to the orchestrator', () => {
    expect(
      decide({ session: sessionOf({ workflowRuns: [runOf({ createdMs: DAY_MS })] }) }).isInactive,
    ).toBe(false);
    expect(
      decide({
        session: sessionOf({ workflowRuns: [runOf({ createdMs: 9 * DAY_MS, hintMs: HOUR_MS })] }),
      }).isInactive,
    ).toBe(false);
  });

  it('counts the time of the session state itself', () => {
    const session = aSession({
      createdAt: ago({ ms: 30 * DAY_MS }),
      updatedAt: ago({ ms: 30 * DAY_MS }),
      state: { kind: 'ended', endedAt: ago({ ms: HOUR_MS }) },
    });

    expect(decide({ session })).toEqual({ isInactive: false, lastActivityAt: NOW - HOUR_MS });
  });

  it('ignores a stamp it cannot read and falls back to the others', () => {
    const session = { ...sessionOf(), lastOpenedAt: brandId<IsoDateTime>({ value: 'not a date' }) };

    expect(decide({ session })).toEqual({ isInactive: true, lastActivityAt: NOW - 5 * DAY_MS });
  });

  it('brings an inactive session back the moment it is touched again', () => {
    const session = sessionOf();
    expect(decide({ session }).isInactive).toBe(true);

    expect(decide({ session: { ...session, lastOpenedAt: ago({ ms: 0 }) } }).isInactive).toBe(
      false,
    );
    expect(decide({ session, seenActivityAt: NOW }).isInactive).toBe(false);
    expect(
      decide({ session, info: { ...QUIET, stage: 'running', isRunning: true } }).isInactive,
    ).toBe(false);
    expect(decide({ session, hasDraft: true }).isInactive).toBe(false);
  });
});
