import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import {
  buildDelegationResult,
  renderDelegationResult,
  resolveDelegationOutcome,
  type BuildResultParams,
} from './result';

const ID = 'agent-implementer-1';

const closingOf = (text: string) => parseChildClosing({ text, childAgentId: ID });

const base = (overrides: Partial<BuildResultParams> = {}): BuildResultParams => ({
  delegationId: 'delegation-1',
  attemptId: 'attempt-1',
  treeId: 'tree-1',
  generation: 1,
  childAgentId: ID,
  role: 'implementer',
  routing: {
    provider: 'anthropic',
    model: 'sonnet',
    effort: 'medium',
    reason: 'a standard change',
  },
  exit: 'ok',
  isTimedOut: false,
  turns: 2,
  durationMs: 61_000,
  closing: closingOf(`Done.\n<<step-done id="${ID}">>`),
  summary: null,
  summarySource: 'child',
  changedFiles: [{ path: 'src/ledger.ts', ownership: 'attempt' }],
  checks: [],
  artifacts: [],
  artifactPersistence: 'not_applicable',
  isArtifactExpected: false,
  openQuestions: [],
  costUsd: 0.42,
  reservedCeilingUsd: 3,
  ...overrides,
});

describe('the outcome of a delegation', () => {
  it('is completed when the child closed with the closing line and the process exited cleanly', () => {
    expect(buildDelegationResult(base())).toMatchObject({
      outcome: 'completed',
      reason: null,
      declared: { completion: 'done' },
    });
  });

  it('fails a missing closing line unless the harness verified an artifact', () => {
    const missing = base({ closing: closingOf('I am done, trust me.') });
    expect(buildDelegationResult(missing)).toMatchObject({
      outcome: 'failed',
      reason: 'no_closing_envelope',
      declared: { completion: 'none' },
    });
    const withArtifact = base({
      closing: closingOf('here is the report'),
      isArtifactExpected: true,
      artifactPersistence: 'ok',
      artifacts: [
        {
          id: 'artifact-report-1',
          kind: 'report',
          title: 'Callers',
          contentHash: 'abcdef0123456789',
          revision: 1,
          baseRevision: null,
        },
      ],
    });
    expect(buildDelegationResult(withArtifact)).toMatchObject({
      outcome: 'completed',
      declared: { completion: 'none' },
    });
  });

  it('forces a failure when an artifact the role owes could not be saved', () => {
    expect(
      buildDelegationResult(base({ isArtifactExpected: true, artifactPersistence: 'failed' })),
    ).toMatchObject({ outcome: 'failed', reason: 'artifact_persistence_failed' });
  });

  it('reads a declared block as blocked, a cancelled process as stopped, a deadline as timed out', () => {
    expect(
      resolveDelegationOutcome({
        exit: 'ok',
        isTimedOut: false,
        closing: closingOf(`stuck\n<<step-done id="${ID}" status="blocked">>`),
        artifactCount: 0,
        artifactPersistence: 'not_applicable',
        isArtifactExpected: false,
      }).outcome,
    ).toBe('blocked');
    expect(
      resolveDelegationOutcome({
        exit: 'cancelled',
        isTimedOut: false,
        closing: null,
        artifactCount: 0,
        artifactPersistence: 'not_applicable',
        isArtifactExpected: false,
      }).outcome,
    ).toBe('stopped');
    expect(
      resolveDelegationOutcome({
        exit: 'unknown',
        isTimedOut: true,
        closing: null,
        artifactCount: 0,
        artifactPersistence: 'not_applicable',
        isArtifactExpected: false,
      }).outcome,
    ).toBe('timed_out');
  });

  it('charges the reserved ceiling when the provider reported no cost', () => {
    expect(buildDelegationResult(base({ costUsd: null })).cost).toEqual({
      usd: 3,
      basis: 'reserved_ceiling',
    });
    expect(buildDelegationResult(base()).cost).toEqual({ usd: 0.42, basis: 'reported' });
  });

  it('renders the result for Auto with the facts the harness verified', () => {
    const text = renderDelegationResult({ result: buildDelegationResult(base()) });
    expect(text).toContain('implementer agent-implementer-1 (delegation-1): completed');
    expect(text).toContain('changed files: src/ledger.ts (attempt)');
    expect(text).toContain('cost 0.42 USD (reported)');
  });
});
