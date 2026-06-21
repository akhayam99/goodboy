import type { PlanWithCount, SessionId, WorkflowRunId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { selectClustersPlan, selectFanOutPlan } from './clusterImplementation';
import type { GetFn } from './types';

const plan = (over: Partial<Omit<PlanWithCount, 'id'>> & { id?: string }): PlanWithCount =>
  ({
    id: 'p1',
    sessionId: 's1',
    agentId: 'a',
    title: 'goal',
    bodyMd: '',
    status: 'active',
    consumptionCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clusters: [
      { title: 'c0', instructions: 'do 0' },
      { title: 'c1', instructions: 'do 1' },
    ],
    ...over,
  }) as PlanWithCount;

describe('selectClustersPlan', () => {
  it('returns null for an empty plan list', () => {
    expect(selectClustersPlan([])).toBeNull();
  });

  it('returns null when the only plan has fewer than 2 clusters', () => {
    expect(
      selectClustersPlan([plan({ clusters: [{ title: 'c0', instructions: 'x' }] })]),
    ).toBeNull();
  });

  it('returns null when the plan has no clusters field', () => {
    expect(selectClustersPlan([plan({ clusters: undefined })])).toBeNull();
  });

  it('matches an ad-hoc plan (no workflowRunId) when no target is given', () => {
    const p = plan({ id: 'ad-hoc' });
    expect(selectClustersPlan([p])?.id).toBe('ad-hoc');
  });

  it('does not match an ad-hoc plan against a workflowRunId target', () => {
    expect(selectClustersPlan([plan({})], 'wf1' as WorkflowRunId)).toBeNull();
  });

  it('matches a plan by workflowRunId', () => {
    const p = plan({ id: 'wf-plan', workflowRunId: 'wf1' as WorkflowRunId });
    expect(selectClustersPlan([p], 'wf1' as WorkflowRunId)?.id).toBe('wf-plan');
  });

  it('does not match a workflow plan when the target is undefined (ad-hoc lookup)', () => {
    const p = plan({ workflowRunId: 'wf1' as WorkflowRunId });
    expect(selectClustersPlan([p])).toBeNull();
  });

  it('returns the most recent matching plan (reverse iteration, last wins)', () => {
    const first = plan({ id: 'first' });
    const second = plan({ id: 'second' });
    expect(selectClustersPlan([first, second])?.id).toBe('second');
  });

  it('skips a trailing invalid plan and returns the earlier valid one', () => {
    const valid = plan({ id: 'valid' });
    const short = plan({ id: 'short', clusters: [{ title: 'only', instructions: 'x' }] });
    expect(selectClustersPlan([valid, short])?.id).toBe('valid');
  });

  it('isolates plans across workflow runs', () => {
    const wf1 = plan({ id: 'p-wf1', workflowRunId: 'wf1' as WorkflowRunId });
    const wf2 = plan({ id: 'p-wf2', workflowRunId: 'wf2' as WorkflowRunId });
    expect(selectClustersPlan([wf1, wf2], 'wf1' as WorkflowRunId)?.id).toBe('p-wf1');
    expect(selectClustersPlan([wf1, wf2], 'wf2' as WorkflowRunId)?.id).toBe('p-wf2');
  });
});

const fakeGet = (plans: ReadonlyArray<PlanWithCount>): GetFn =>
  (() => ({ sessionPlans: { s1: plans } })) as unknown as GetFn;

describe('selectFanOutPlan', () => {
  const sessionId = 's1' as SessionId;

  it('returns the explicit plan directly when it has 2+ clusters', () => {
    const explicit = plan({ id: 'explicit' });
    const result = selectFanOutPlan(fakeGet([plan({ id: 'store' })]), sessionId, {
      explicitPlan: explicit,
    });
    expect(result?.id).toBe('explicit');
  });

  it('falls back to the store lookup when the explicit plan has too few clusters', () => {
    const explicit = plan({ id: 'explicit', clusters: [{ title: 'c0', instructions: 'x' }] });
    const result = selectFanOutPlan(fakeGet([plan({ id: 'store' })]), sessionId, {
      explicitPlan: explicit,
    });
    expect(result?.id).toBe('store');
  });

  it('delegates to the store lookup by workflowRunId when no explicit plan is given', () => {
    const stored = plan({ id: 'wf-store', workflowRunId: 'wf1' as WorkflowRunId });
    const result = selectFanOutPlan(fakeGet([stored]), sessionId, {
      workflowRunId: 'wf1' as WorkflowRunId,
    });
    expect(result?.id).toBe('wf-store');
  });

  it('returns null when neither an explicit nor a stored plan qualifies', () => {
    expect(selectFanOutPlan(fakeGet([]), sessionId, {})).toBeNull();
  });
});
