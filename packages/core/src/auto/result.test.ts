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
  ...overrides,
});

describe('the summary a delegation carries', () => {
  it('carries a closing excerpt up to the Runs budget without cutting its last line', () => {
    const text = `${'a'.repeat(6_000)}\nLast line.\n<<step-done id="${ID}">>`;
    const built = buildDelegationResult(base({ closing: closingOf(text) }));
    expect(built.declared.summary.length).toBeLessThanOrEqual(4_000);
    expect(built.declared.summary.endsWith('Last line.')).toBe(true);
  });
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

  it('names a report the role never wrote, apart from one it could not save', () => {
    const scout = { role: 'scout', isArtifactExpected: true } as const;
    expect(
      buildDelegationResult(base({ ...scout, artifactPersistence: 'not_written' })),
    ).toMatchObject({ outcome: 'failed', reason: 'report_missing' });
    expect(
      buildDelegationResult(
        base({
          ...scout,
          artifactPersistence: 'not_written',
          closing: closingOf('superseded, nothing to add.'),
        }),
      ),
    ).toMatchObject({ outcome: 'failed', reason: 'no_closing_envelope' });
    expect(
      renderDelegationResult({
        result: buildDelegationResult(base({ ...scout, artifactPersistence: 'not_written' })),
      }),
    ).toContain('it wrote no report');
  });

  it('keeps a declared block as blocked when the role owes a report it did not write', () => {
    const blocked = base({
      role: 'scout',
      isArtifactExpected: true,
      closing: closingOf(
        `Cannot read the pull request.\n<<step-done id="${ID}" status="blocked">>`,
      ),
    });
    expect(buildDelegationResult({ ...blocked, artifactPersistence: 'not_written' })).toMatchObject(
      { outcome: 'blocked', reason: 'declared_blocked' },
    );
    expect(buildDelegationResult({ ...blocked, artifactPersistence: 'failed' })).toMatchObject({
      outcome: 'blocked',
      reason: 'declared_blocked',
    });
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

  it('leaves the cost unknown when no cost was recorded, never a ceiling', () => {
    const result = buildDelegationResult(base({ costUsd: null }));
    expect(result.cost).toEqual({ usd: null, basis: 'estimate' });
    expect(renderDelegationResult({ result })).toContain('s, cost unknown');
    expect(buildDelegationResult(base({ costUsd: 7.5 })).cost).toEqual({
      usd: 7.5,
      basis: 'reported',
    });
    expect(buildDelegationResult(base()).cost).toEqual({ usd: 0.42, basis: 'reported' });
  });

  it('renders the result for Auto with the facts the harness verified', () => {
    const text = renderDelegationResult({ result: buildDelegationResult(base()) });
    expect(text).toContain('implementer agent-implementer-1 (delegation-1): completed');
    expect(text).toContain('changed files: src/ledger.ts (attempt)');
    expect(text).toContain('cost 0.42 USD (reported)');
  });

  it('tells Auto when the branch moved online and when that is unknown, and omits it otherwise', () => {
    const remote = (status: 'moved' | 'unknown' | 'unchanged') => ({
      status,
      branch: 'ak/ledger-export',
      before: 'aaa111',
      after: status === 'moved' ? 'bbb222' : 'aaa111',
    });
    const render = (params: Partial<BuildResultParams>) =>
      renderDelegationResult({ result: buildDelegationResult(base(params)) });
    expect(render({ remote: remote('moved') })).toContain(
      'The branch changed online while this agent worked (ak/ledger-export)',
    );
    expect(render({ remote: remote('unknown') })).toContain('could not be read (ak/ledger-export)');
    expect(render({ remote: remote('unchanged') })).not.toContain('online');
    expect(render({})).not.toContain('online');
    expect(buildDelegationResult(base({ remote: null })).verified).not.toHaveProperty('remote');
  });

  it('leads with the name of the agent when it has one', () => {
    const text = renderDelegationResult({
      result: buildDelegationResult(base()),
      label: 'Implementer 2',
    });
    expect(
      text.startsWith('- Implementer 2 (implementer agent-implementer-1, delegation-1): completed'),
    ).toBe(true);
  });
});
