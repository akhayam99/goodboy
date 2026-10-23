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

  it('puts the smallest limit first and says where it comes from', () => {
    const own = runSettingsOf({ ...BASE, run: { ...RUN, spendLimitUsd: 5 } }).limit;
    expect(own).toEqual({
      value: '$0.92 of $5.00',
      source: 'this run',
      chain: 'This run $5.00, then session $8.00. $5.00 comes first.',
    });

    const session = runSettingsOf({ ...BASE, run: { ...RUN, spendLimitUsd: 12 } }).limit;
    expect(session.value).toBe('$0.92 of $8.00');
    expect(session.source).toBe('from session');
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
