import { describe, expect, it } from 'vitest';
import type { ContextSlot } from '@kay-am/types';
import type { ContextSlotDelta, SummarizeInput } from './client';
import {
  evaluateSpawnReadiness,
  inferNextActions,
  type NextAction,
  type NextActionsPrState,
} from './next-actions';

const LOCKED_GOAL = 'add caching layer to the auth module';

function buildInput(
  turnOutput: string,
  prevSlots: ReadonlyArray<ContextSlot> = [],
): SummarizeInput {
  return { turnInput: 'q', turnOutput, prevSlots };
}

function delta(upserts: Array<{ key: string; value: string }> = []): ContextSlotDelta {
  return { upserts: upserts as ContextSlotDelta['upserts'] };
}

function slots(map: Record<string, string>, opts: { withGoal?: boolean } = {}): ContextSlot[] {
  const out: ContextSlot[] = [];
  if (opts.withGoal !== false && map.goal === undefined) {
    out.push({ key: 'goal', value: LOCKED_GOAL, enabled: true });
  }
  for (const [key, value] of Object.entries(map)) {
    out.push({ key, value, enabled: true });
  }
  return out;
}

function findById<T extends NextAction['id']>(
  actions: ReadonlyArray<NextAction>,
  id: T,
): Extract<NextAction, { id: T }> | undefined {
  return actions.find((a) => a.id === id) as Extract<NextAction, { id: T }> | undefined;
}

describe('inferNextActions — trigger gating', () => {
  it('returns [] when open_questions slot has content (still refining)', () => {
    const actions = inferNextActions({
      input: buildInput('here is a draft plan'),
      delta: delta(),
      slotsAfter: slots({ open_questions: 'which db driver?' }),
    });
    expect(actions).toEqual([]);
  });

  it('returns [] when goal is empty (still framing)', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan'),
      delta: delta(),
      slotsAfter: slots({ goal: '' }, { withGoal: false }),
    });
    expect(actions).toEqual([]);
  });

  it('returns [] when goal is very short (still framing)', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan'),
      delta: delta(),
      slotsAfter: slots({ goal: 'fix it' }, { withGoal: false }),
    });
    expect(actions).toEqual([]);
  });

  it('surfaces actions once goal is locked and no open questions remain', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan for the new caching layer'),
      delta: delta(),
      slotsAfter: slots({}),
    });
    expect(actions.length).toBeGreaterThan(0);
  });
});

describe('inferNextActions — option set after each phase', () => {
  it('after scout turn → plan + refine scope', () => {
    const actions = inferNextActions({
      input: buildInput('explored the auth module and mapped its dependencies'),
      delta: delta([{ key: 'last_output_summary', value: 'investigated auth code paths' }]),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'spawn_planner')).toBeDefined();
    expect(findById(actions, 'spawn_scout')).toBeDefined();
  });

  it('after plan turn → implement + refine plan', () => {
    const actions = inferNextActions({
      input: buildInput('drafted a plan for the new caching layer'),
      delta: delta([{ key: 'last_output_summary', value: 'planned caching design' }]),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'spawn_implementer')).toBeDefined();
    expect(findById(actions, 'spawn_planner')).toBeDefined();
  });

  it('after implementation turn → review + tests + open pr', () => {
    const actions = inferNextActions({
      input: buildInput('implemented the new endpoint'),
      delta: delta([{ key: 'last_output_summary', value: 'wrote handler' }]),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'spawn_reviewer')).toBeDefined();
    expect(findById(actions, 'spawn_tester')).toBeDefined();
    expect(findById(actions, 'open_pr')).toBeDefined();
  });

  it('after implementation that already mentions tests → review + open pr (no extra test chip)', () => {
    const actions = inferNextActions({
      input: buildInput('implemented endpoint and added unit tests'),
      delta: delta(),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'spawn_reviewer')).toBeDefined();
    expect(findById(actions, 'spawn_tester')).toBeUndefined();
    expect(findById(actions, 'open_pr')).toBeDefined();
  });

  it('after implementation when PR already exists → suggests neither open_pr nor a new impl chip', () => {
    const actions = inferNextActions({
      input: buildInput('implemented and opened pr #42'),
      delta: delta(),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'open_pr')).toBeUndefined();
  });
});

describe('inferNextActions — bug + pr-state branches', () => {
  it('suggests debug + tests when bug mentioned', () => {
    const actions = inferNextActions({
      input: buildInput('found a bug in auth/session.ts where tokens leak across requests'),
      delta: delta(),
      slotsAfter: slots({}),
    });
    const debug = findById(actions, 'spawn_debugger');
    expect(debug).toBeDefined();
    expect(debug?.payload?.topic).toMatch(/auth\/session\.ts/);
    expect(findById(actions, 'spawn_tester')).toBeDefined();
  });

  it('returns merge_pr only when PR open + checks green', () => {
    const prState: NextActionsPrState = { hasOpenPr: true, checksGreen: true };
    const actions = inferNextActions({
      input: buildInput('ci passed'),
      delta: delta(),
      slotsAfter: slots({}),
      prState,
    });
    expect(actions).toEqual([{ id: 'merge_pr', label: 'merge pr' }]);
  });

  it('returns debug + tests when PR open + checks failing', () => {
    const prState: NextActionsPrState = { hasOpenPr: true, checksGreen: false };
    const actions = inferNextActions({
      input: buildInput('ci red'),
      delta: delta(),
      slotsAfter: slots({}),
      prState,
    });
    expect(findById(actions, 'spawn_debugger')).toBeDefined();
    expect(findById(actions, 'spawn_tester')).toBeDefined();
  });

  it('pr-state branches override the refinement gate', () => {
    const prState: NextActionsPrState = { hasOpenPr: true, checksGreen: true };
    const actions = inferNextActions({
      input: buildInput('ci passed'),
      delta: delta(),
      slotsAfter: slots({ open_questions: 'still unclear' }),
      prState,
    });
    expect(actions).toEqual([{ id: 'merge_pr', label: 'merge pr' }]);
  });
});

describe('inferNextActions — invariants', () => {
  it('caps at 3 actions', () => {
    const actions = inferNextActions({
      input: buildInput(
        'scouted the code, drafted a plan, implemented the change, found a regression',
      ),
      delta: delta(),
      slotsAfter: slots({}),
    });
    expect(actions.length).toBeLessThanOrEqual(3);
  });

  it('returns a generic plan + refine fallback when goal locked and nothing else fires', () => {
    const actions = inferNextActions({
      input: buildInput('hello world'),
      delta: delta(),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'spawn_planner')).toBeDefined();
    expect(findById(actions, 'spawn_scout')).toBeDefined();
  });

  it('reads delta upsert values to detect impl phase', () => {
    const actions = inferNextActions({
      input: buildInput(''),
      delta: delta([{ key: 'last_output_summary', value: 'finished implementation of feature X' }]),
      slotsAfter: slots({}),
    });
    expect(findById(actions, 'open_pr')).toBeDefined();
  });
});

describe('evaluateSpawnReadiness', () => {
  it('returns ready when nothing is in flight', () => {
    expect(evaluateSpawnReadiness({ streaming: false, summarizing: false })).toEqual({
      kind: 'ready',
    });
  });

  it('returns confirm/streaming when only the assistant turn is streaming', () => {
    expect(evaluateSpawnReadiness({ streaming: true, summarizing: false })).toEqual({
      kind: 'confirm',
      reason: 'streaming',
    });
  });

  it('returns confirm/summarizing when only the summarizer is running', () => {
    expect(evaluateSpawnReadiness({ streaming: false, summarizing: true })).toEqual({
      kind: 'confirm',
      reason: 'summarizing',
    });
  });

  it('prefers summarizing reason when both are in flight (stale slots are the concrete risk)', () => {
    expect(evaluateSpawnReadiness({ streaming: true, summarizing: true })).toEqual({
      kind: 'confirm',
      reason: 'summarizing',
    });
  });
});
