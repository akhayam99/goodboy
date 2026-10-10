// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { OrchestratorPhase } from './components/OrchestratorStrip/orchestratorState';
import { runPrimaryOf, type RunFlow, type RunPlanHold, type RunPrimaryKind } from './runPrimaryOf';

type Live = {
  readonly hold?: RunPlanHold;
  readonly flow: RunFlow;
};

const live = ({ hold = 'none', flow }: Live) =>
  runPrimaryOf({ isDiscarded: false, isFinished: false, isQueuedManual: false, hold, flow });

const dynamic = ({
  phase,
  hasQuestion = false,
  isAutoRun = false,
}: {
  readonly phase: OrchestratorPhase;
  readonly hasQuestion?: boolean;
  readonly isAutoRun?: boolean;
}): RunFlow => ({ kind: 'dynamic', phase, hasQuestion, isAutoRun });

const EXPECTED_BY_PHASE: Readonly<Record<OrchestratorPhase, RunPrimaryKind | null>> = {
  deciding: null,
  paused: 'resume',
  stopping: null,
  waiting: null,
  automatic: null,
  'ready-first': 'decide-next',
  'ready-mid': 'decide-next',
  'needs-answer': 'answer',
  'paused-budget': 'raise-cap',
  blocked: 'retry',
  'needs-approval': null,
  'plan-approval': 'review-plan',
  'plan-revising': 'review-plan',
  'plan-question': 'answer',
  failed: 'retry',
  'step-failed': null,
  stopped: 'continue',
  done: null,
};

const isPhase = (value: string): value is OrchestratorPhase => value in EXPECTED_BY_PHASE;

const ROWS: ReadonlyArray<{
  readonly phase: OrchestratorPhase;
  readonly expected: RunPrimaryKind | null;
}> = Object.keys(EXPECTED_BY_PHASE).flatMap((key) =>
  isPhase(key) ? [{ phase: key, expected: EXPECTED_BY_PHASE[key] }] : [],
);

const primaryAt = ({ phase }: { readonly phase: OrchestratorPhase }) =>
  live({
    hold: phase.startsWith('plan-') ? 'with-plan' : 'none',
    flow: dynamic({ phase, hasQuestion: true }),
  });

describe('runPrimaryOf over every orchestrator phase', () => {
  it('covers every phase of the strip', () => {
    expect(ROWS).toHaveLength(Object.keys(EXPECTED_BY_PHASE).length);
  });

  it.each(ROWS)('phase $phase offers $expected', ({ phase, expected }) => {
    expect(primaryAt({ phase })?.kind ?? null).toBe(expected);
  });

  it('names every primary the way the owner reads it', () => {
    const labels = ROWS.flatMap(({ phase }) => primaryAt({ phase })?.label ?? []);

    expect(new Set(labels)).toEqual(
      new Set([
        'Resume',
        'Decide next step',
        'Answer',
        'Raise spend cap',
        'Retry',
        'Review plan',
        'Continue the run',
      ]),
    );
  });
});

describe('runPrimaryOf edges', () => {
  it('offers Restore on an archived run whatever its phase says', () => {
    const primary = runPrimaryOf({
      isDiscarded: true,
      isFinished: false,
      isQueuedManual: false,
      hold: 'none',
      flow: dynamic({ phase: 'failed' }),
    });

    expect(primary).toEqual({ kind: 'restore', label: 'Restore' });
  });

  it('offers nothing on a finished run', () => {
    const primary = runPrimaryOf({
      isDiscarded: false,
      isFinished: true,
      isQueuedManual: false,
      hold: 'none',
      flow: dynamic({ phase: 'done' }),
    });

    expect(primary).toBeNull();
  });

  it('offers Start run on a queued manual run before anything else', () => {
    const primary = runPrimaryOf({
      isDiscarded: false,
      isFinished: false,
      isQueuedManual: true,
      hold: 'none',
      flow: { kind: 'static', isPaused: false, nextStepNumber: 1 },
    });

    expect(primary).toEqual({ kind: 'start-run', label: 'Start run' });
  });

  it('keeps Review plan for a held plan that has a question nobody can open', () => {
    const primary = live({
      hold: 'with-plan',
      flow: dynamic({ phase: 'plan-question', hasQuestion: false }),
    });

    expect(primary?.kind).toBe('review-plan');
  });

  it('offers Approve plan only when a held run has no plan to read', () => {
    const primary = live({
      hold: 'without-plan',
      flow: dynamic({ phase: 'plan-approval' }),
    });

    expect(primary?.kind).toBe('approve-plan');
  });

  it('offers nothing to start when the run goes on by itself', () => {
    const primary = live({ flow: dynamic({ phase: 'ready-mid', isAutoRun: true }) });

    expect(primary).toBeNull();
  });

  it.each([
    ['a plan is waiting', 'with-plan', { kind: 'review-plan', label: 'Review plan' }],
    ['no plan exists', 'without-plan', { kind: 'approve-plan', label: 'Approve plan' }],
  ] as const)('puts the plan first on a static run when %s', (_name, hold, expected) => {
    const primary = live({
      hold,
      flow: { kind: 'static', isPaused: true, nextStepNumber: 2 },
    });

    expect(primary).toEqual(expected);
  });

  it('resumes a paused static run before it offers the next step', () => {
    const primary = live({ flow: { kind: 'static', isPaused: true, nextStepNumber: 2 } });

    expect(primary?.kind).toBe('resume');
  });

  it('numbers the next step of a static run', () => {
    const primary = live({ flow: { kind: 'static', isPaused: false, nextStepNumber: 2 } });

    expect(primary).toEqual({ kind: 'start-step', label: 'Start step 2' });
  });

  it('offers nothing on a static run with no step waiting', () => {
    const primary = live({ flow: { kind: 'static', isPaused: false, nextStepNumber: null } });

    expect(primary).toBeNull();
  });
});
