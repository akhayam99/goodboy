// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import { runProviderPool } from './runProviderPool';

const POOLED = aWorkflowRun({ providerPool: ['codex'] });
const OPEN = aWorkflowRun();
const SESSION = aSession({ workflowRuns: [POOLED, OPEN] });
const SESSIONS = [SESSION];

type PoolParams = {
  readonly workflowRunId: typeof POOLED.id | null;
  readonly workspacePool?: ReadonlyArray<'anthropic' | 'codex'> | null;
};

const poolOf = ({ workflowRunId, workspacePool }: PoolParams) =>
  runProviderPool({
    sessions: SESSIONS,
    sessionId: SESSION.id,
    workflowRunId,
    ...(workspacePool !== undefined && { workspacePool }),
  });

describe('runProviderPool precedence', () => {
  it('lets the run pool win over the workspace pool', () => {
    expect(poolOf({ workflowRunId: POOLED.id, workspacePool: ['anthropic'] })).toEqual(['codex']);
  });

  it('falls back to the workspace pool when the run has none', () => {
    expect(poolOf({ workflowRunId: OPEN.id, workspacePool: ['anthropic'] })).toEqual(['anthropic']);
  });

  it('uses the workspace pool for an agent outside any run', () => {
    expect(poolOf({ workflowRunId: null, workspacePool: ['anthropic', 'codex'] })).toEqual([
      'anthropic',
      'codex',
    ]);
  });

  it('is open when neither the run nor the workspace names a pool', () => {
    expect(poolOf({ workflowRunId: null })).toBeNull();
    expect(poolOf({ workflowRunId: OPEN.id, workspacePool: null })).toBeNull();
  });
});
