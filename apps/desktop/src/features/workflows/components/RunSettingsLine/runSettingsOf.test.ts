import { describe, expect, it } from 'vitest';
import type { WorkflowId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { brandId, DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { runSettingsOf } from './runSettingsOf';

const RUN: WorkflowRun = {
  id: brandId<WorkflowRunId>({ value: 'run-center-pages' }),
  workflowId: brandId<WorkflowId>({ value: 'workflow-orchestrated' }),
  ordinal: 0,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
};

const BASE = {
  run: RUN,
  workspaceName: 'Harborline',
  workspaceAutonomy: 'step' as const,
  sessionCapUsd: 8,
  spentUsd: 0.92,
  sessionSpentUsd: 3.4,
  providers: ['anthropic', 'codex'] as const,
};

describe('runSettingsOf', () => {
  it('says the run wins when it asks differently from the workspace', () => {
    const { asks } = runSettingsOf(BASE);

    expect(asks.source).toBe('this run');
    expect(asks.chain).toMatch(/^This run: .+\. Harborline: .+\. The run wins\.$/);
  });

  it('names the workspace as the source when the run kept its default', () => {
    const { asks } = runSettingsOf({ ...BASE, workspaceAutonomy: 'plan' });

    expect(asks.source).toBe('from Harborline');
    expect(asks.chain).toMatch(/^From Harborline: /);
  });

  it('counts the run against its own limit when that limit comes first', () => {
    const own = runSettingsOf({ ...BASE, run: { ...RUN, spendLimitUsd: 5 } }).limit;
    expect(own).toEqual({
      value: '$0.92 of $5.00',
      source: 'this run',
      chain: 'This run $5.00, then session $8.00. $5.00 comes first.',
    });
  });

  it('counts the whole session against the session cap when that cap comes first', () => {
    const session = runSettingsOf({ ...BASE, run: { ...RUN, spendLimitUsd: 12 } }).limit;
    expect(session).toEqual({
      value: '$3.40 of $8.00',
      source: 'from session',
      chain:
        'This run $12.00, then session $8.00. $8.00 comes first, counted over the whole session: $3.40 spent, $0.92 of it this run.',
    });
  });

  it('reads 17 of 20 for a run that spent 2 inside a session that spent 17', () => {
    const { limit } = runSettingsOf({
      ...BASE,
      sessionCapUsd: 20,
      sessionSpentUsd: 17,
      spentUsd: 2,
    });

    expect(limit.value).toBe('$17.00 of $20.00');
    expect(limit.source).toBe('from session');
    expect(limit.chain).toContain('$2.00 of it this run');
  });

  it('counts the session when the run has no limit of its own', () => {
    const { limit } = runSettingsOf({ ...BASE, sessionCapUsd: 8 });

    expect(limit.value).toBe('$3.40 of $8.00');
    expect(limit.chain).toBe(
      'This run none, then session $8.00. $8.00 comes first, counted over the whole session: $3.40 spent, $0.92 of it this run.',
    );
  });

  it('keeps the run spend when both limits are the same amount', () => {
    const { limit } = runSettingsOf({ ...BASE, run: { ...RUN, spendLimitUsd: 8 } });

    expect(limit.value).toBe('$0.92 of $8.00');
    expect(limit.source).toBe('this run');
  });

  it('says nothing stops a run with no limit anywhere', () => {
    const { limit } = runSettingsOf({ ...BASE, sessionCapUsd: null });

    expect(limit.value).toBe('$0.92 spent');
    expect(limit.chain).toBe('This run none, then session none. Nothing stops this run.');
  });

  it('reads the providers the run may use, its own or the workspace ones', () => {
    expect(runSettingsOf(BASE).models).toEqual({
      value: 'Auto on Claude, Codex',
      source: 'from Harborline',
      chain: 'This run: none set. Harborline: Claude, Codex. Harborline wins.',
    });
    const own = runSettingsOf({ ...BASE, run: { ...RUN, providerPool: ['codex'] } }).models;
    expect(own.value).toBe('Auto on Codex');
    expect(own.chain).toBe('This run: Codex. Harborline: Claude, Codex. The run wins.');
  });
});
