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

  it('fails a return as a lost report when the role owes a report it did not write', () => {
    const returned = base({
      role: 'scout',
      isArtifactExpected: true,
      closing: closingOf(
        `Cannot read the pull request.\n<<step-done id="${ID}" status="returned" needs="shell">>\nA shell.`,
      ),
    });
    expect(
      buildDelegationResult({ ...returned, artifactPersistence: 'not_written' }),
    ).toMatchObject({ outcome: 'failed', reason: 'report_missing' });
    expect(buildDelegationResult({ ...returned, artifactPersistence: 'failed' })).toMatchObject({
      outcome: 'failed',
      reason: 'artifact_persistence_failed',
    });
    expect(buildDelegationResult({ ...returned, artifactPersistence: 'ok' })).toMatchObject({
      outcome: 'blocked',
      reason: 'needs_shell',
    });
  });

  it('reads the reason of a return from its needs attribute', () => {
    const cases = [
      ['shell', 'needs_shell'],
      ['writer', 'needs_writer'],
      ['role:investigator', 'needs_role'],
      ['decision', 'needs_decision'],
      ['user', 'needs_user'],
    ] as const;
    for (const [needs, reason] of cases) {
      const result = buildDelegationResult(
        base({
          closing: closingOf(
            `Half done.\n<<step-done id="${ID}" status="returned" needs="${needs}">>\nOne request.`,
          ),
        }),
      );
      expect(result, needs).toMatchObject({ outcome: 'blocked', reason });
      expect(result.returned?.request, needs).toBe('One request.');
    }
  });

  it('lets the attribute win over a closing written in another language', () => {
    const result = buildDelegationResult(
      base({
        closing: closingOf(
          `Non posso leggere i commit di payments-api.\n<<step-done id="${ID}" status="blocked" needs="shell">>\nServe una shell.`,
        ),
      }),
    );
    expect(result).toMatchObject({ outcome: 'blocked', reason: 'needs_shell' });
    expect(renderDelegationResult({ result })).toContain('a role that can run commands');
    expect(renderDelegationResult({ result })).toContain('it asks: Serve una shell.');
  });

  it('reads an old block with no needs as needs_user, and the shell text only without the attribute', () => {
    expect(
      buildDelegationResult(
        base({
          closing: closingOf(`The mount is gone.\n<<step-done id="${ID}" status="blocked">>`),
        }),
      ),
    ).toMatchObject({ outcome: 'blocked', reason: 'needs_user' });
    expect(
      buildDelegationResult(
        base({
          closing: closingOf(`I have no shell here.\n<<step-done id="${ID}" status="blocked">>`),
        }),
      ),
    ).toMatchObject({ reason: 'needs_shell' });
    expect(
      buildDelegationResult(
        base({
          closing: closingOf(
            `I have no shell here.\n<<step-done id="${ID}" status="returned" needs="decision">>`,
          ),
        }),
      ),
    ).toMatchObject({ reason: 'needs_decision' });
  });

  it('adds the writer reroute line to a return that needs files changed', () => {
    const result = buildDelegationResult(
      base({
        role: 'scout',
        closing: closingOf(`Found it.\n<<step-done id="${ID}" status="returned" needs="writer">>`),
      }),
    );
    expect(renderDelegationResult({ result })).toContain('a role that changes files');
  });

  it('keeps no return on a done result', () => {
    expect(buildDelegationResult(base()).returned).toBeUndefined();
  });

  it('settles an old blocked closing with no report as blocked with the shell reroute', () => {
    const result = buildDelegationResult(
      base({
        role: 'scout',
        isArtifactExpected: true,
        artifactPersistence: 'not_written',
        closing: closingOf(`I have no shell here.\n<<step-done id="${ID}" status="blocked">>`),
      }),
    );
    expect(result).toMatchObject({ outcome: 'blocked', reason: 'needs_shell' });
    expect(renderDelegationResult({ result })).toContain('a role that can run commands');
  });

  it('fails a return with no needs and no report as a lost report', () => {
    const returned = base({
      role: 'scout',
      isArtifactExpected: true,
      closing: closingOf(`Partial.\n<<step-done id="${ID}" status="returned">>\nA shell.`),
    });
    expect(
      buildDelegationResult({ ...returned, artifactPersistence: 'not_written' }),
    ).toMatchObject({ outcome: 'failed', reason: 'report_missing' });
    expect(buildDelegationResult({ ...returned, artifactPersistence: 'failed' })).toMatchObject({
      outcome: 'failed',
      reason: 'artifact_persistence_failed',
    });
  });

  it('names the role a return asks for beside its request', () => {
    const result = buildDelegationResult(
      base({
        closing: closingOf(
          `Half done.\n<<step-done id="${ID}" status="returned" needs="role:planner">>\nPlease finish the next part.`,
        ),
      }),
    );
    const rendered = renderDelegationResult({ result });
    expect(rendered).toContain('it asks for the planner role');
    expect(rendered).toContain('it asks: Please finish the next part.');
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
