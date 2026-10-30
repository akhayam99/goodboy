// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { aDelegation, aPlanRow, aView, FIXTURE_NOW } from '../testing/autoViewFixtures';
import { artifactApprovalOf } from './artifactApprovalOf';
import { batchesOf } from './batchesOf';
import { cardTitleOf } from './cardTitleOf';
import { composerPlaceholderOf } from './composerPlaceholderOf';
import { delegationCardOf } from './delegationCardOf';
import { waitingTextOf } from './waitingTextOf';

const RESULT = {
  schemaVersion: 1,
  declared: { completion: 'done', summary: 'Retry keys are built once per credit.' },
  verified: {
    changedFiles: [
      { path: 'postCredit.ts', ownership: 'attempt' },
      { path: 'applyCredit.ts', ownership: 'attempt' },
    ],
    checks: [
      { name: 'retries a timed out credit once', status: 'pass', source: 'harness' },
      { name: 'rejects a repeated key', status: 'unknown', source: 'child_claim' },
    ],
  },
  artifacts: [
    { id: 'artifact-plan', kind: 'plan', title: 'Retry-safe credit retries', revision: 1 },
  ],
  openQuestions: [{ questionId: 'q1', text: 'Keep the old key format?' }],
  cost: { usd: 0.12, basis: 'reported' },
  reason: null,
};

describe('delegationCardOf', () => {
  it('names the role, the model and the reason of a running child, and no ceiling', () => {
    const child = anAgent({
      id: brandId<AgentId>({ value: 'agent-impl' }),
      startedAt: brandId<IsoDateTime>({ value: new Date(FIXTURE_NOW).toISOString() }),
    });
    const card = delegationCardOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
      childAgent: child,
    });

    expect(card).toMatchObject({
      roleLabel: 'Implementer',
      model: 'opus',
      effort: 'high',
      status: { word: 'Running', isLive: true },
      isOpen: true,
      result: null,
    });
    expect(card).not.toHaveProperty('ceilingUsd');
    expect(card.reason).toContain('idempotency');
  });

  it('names the model and the effort of a child, never its routing id', () => {
    const named = delegationCardOf({
      delegation: aDelegation({
        key: 'x',
        role: 'scout',
        state: 'running',
        model: 'sonnet-5.5',
        effort: 'high',
      }),
      childAgent: null,
    });
    const unknown = delegationCardOf({
      delegation: aDelegation({
        key: 'y',
        role: 'scout',
        state: 'running',
        model: 'ledger-core-1',
      }),
      childAgent: null,
    });

    expect(named.modelLine).toEqual({
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      isUnknown: false,
      rawId: null,
    });
    expect(unknown.modelLine).toMatchObject({
      name: 'Ledger Core 1',
      isUnknown: true,
      rawId: 'ledger-core-1',
    });
  });

  it('maps every delegation state and outcome to one word', () => {
    const wordOf = (
      state: Parameters<typeof aDelegation>[0]['state'],
      outcome?: 'completed' | 'failed' | 'blocked' | 'stopped' | 'timed_out',
    ) =>
      delegationCardOf({
        delegation: aDelegation({ key: 'x', role: 'scout', state, outcome: outcome ?? null }),
        childAgent: null,
      }).status.word;

    expect(wordOf('accepted')).toBe('Queued');
    expect(wordOf('awaiting_confirm')).toBe('Needs you');
    expect(wordOf('starting')).toBe('Starting');
    expect(wordOf('running')).toBe('Running');
    expect(wordOf('paused')).toBe('Needs you');
    expect(wordOf('settled', 'completed')).toBe('Done');
    expect(wordOf('settled', 'failed')).toBe('Failed');
    expect(wordOf('settled', 'blocked')).toBe('Blocked');
    expect(wordOf('settled', 'stopped')).toBe('Stopped');
    expect(wordOf('settled', 'timed_out')).toBe('Timed out');
  });

  it('reads the settled result: summary, files, checks with their source, artifacts, questions, cost', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
        settledAt: FIXTURE_NOW + 60_000,
        result: RESULT,
      }),
      childAgent: null,
    });

    expect(card.result).toMatchObject({
      summary: 'Retry keys are built once per credit.',
      changedFileCount: 2,
      costUsd: 0.12,
      isCostEstimated: false,
      questions: ['Keep the old key format?'],
    });
    expect(card.result?.checks).toEqual([
      { name: 'retries a timed out credit once', status: 'pass', isClaimed: false },
      { name: 'rejects a repeated key', status: 'unknown', isClaimed: true },
    ]);
    expect(card.result?.artifacts).toEqual([
      {
        artifactId: 'artifact-plan',
        kind: 'plan',
        title: 'Retry-safe credit retries',
        revision: 1,
      },
    ]);
    expect(card.isOpen).toBe(false);
  });

  it('says that the branch moved online, or that nobody could tell, and nothing when it did not', () => {
    const remoteTextOf = (status: string | null) =>
      delegationCardOf({
        delegation: aDelegation({
          key: 'impl',
          role: 'implementer',
          state: 'settled',
          outcome: 'completed',
          result: {
            ...RESULT,
            verified: {
              ...RESULT.verified,
              ...(status === null ? {} : { remote: { status, branch: 'ak/ledger-export' } }),
            },
          },
        }),
        childAgent: null,
      }).result?.remoteText;

    expect(remoteTextOf('moved')).toBe('The branch changed online while this agent worked.');
    expect(remoteTextOf('unknown')).toBe('Could not check whether the branch changed online.');
    expect(remoteTextOf('unchanged')).toBeNull();
    expect(remoteTextOf(null)).toBeNull();
  });

  it('reads the verdict of the checks, and offers a rerun only where it can describe the work', () => {
    const resultOf = (checksRun: unknown, checks: ReadonlyArray<unknown> = []) =>
      delegationCardOf({
        delegation: aDelegation({
          key: 'impl',
          role: 'implementer',
          state: 'settled',
          outcome: 'completed',
          result: { ...RESULT, verified: { ...RESULT.verified, checks, checksRun } },
        }),
        childAgent: null,
      }).result;

    const red = resultOf({ verdict: 'red', reason: null, commit: 'abc123' }, [
      { name: 'typecheck', status: 'fail', source: 'harness' },
    ]);
    expect(red?.checksText).toBe('Checks red: typecheck');
    expect(red?.checksVerdict).toBe('red');
    expect(red?.canRerunChecks).toBe(true);
    expect(
      resultOf({ verdict: 'not_checked', reason: 'none_ticked', commit: 'abc123' }),
    ).toMatchObject({
      checksText: 'Not checked: no scripts are ticked as Auto checks',
      canRerunChecks: false,
    });
    expect(
      resultOf({ verdict: 'not_checked', reason: 'tree_dirty', commit: 'abc123' }),
    ).toMatchObject({ canRerunChecks: false });
    expect(resultOf(undefined)).toMatchObject({ checksText: null, canRerunChecks: false });
  });

  it('reads the push record and offers a retry or a put back only where each can work', () => {
    const publishOf = (publish: unknown) =>
      delegationCardOf({
        delegation: aDelegation({
          key: 'impl',
          role: 'implementer',
          state: 'settled',
          outcome: 'completed',
          result: { ...RESULT, verified: { ...RESULT.verified, publish } },
        }),
        childAgent: null,
      }).result?.publish ?? null;
    const base = {
      mode: 'force',
      branch: 'ak/ledger-export',
      sha: 'abc1234def',
      leaseSha: 'remote111',
      backupRef: 'refs/goodboy/backup/b-6b/keep-1',
      message: null,
      isRetryable: false,
      isConfirmed: true,
      tries: 1,
      reviewerReportId: null,
      isContentChanging: false,
    };

    expect(publishOf({ ...base, state: 'awaiting_confirm' })).toMatchObject({
      text: 'Waiting for you to confirm the force push of ak/ledger-export',
      canRetry: false,
      canPutBack: false,
    });
    expect(publishOf({ ...base, state: 'pushed' })).toMatchObject({
      state: 'pushed',
      canPutBack: true,
    });
    expect(
      publishOf({ ...base, state: 'failed', message: 'connection reset', isRetryable: true }),
    ).toMatchObject({ text: 'Not pushed: connection reset', canRetry: true });
    expect(
      publishOf({ ...base, state: 'failed', message: 'x', isRetryable: true, tries: 2 }),
    ).toMatchObject({ canRetry: false });
    expect(publishOf(undefined)).toBeNull();
  });

  it('says a failed child in a sentence and shows an estimated cost as estimated', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'failed',
        result: { reason: 'no_closing_envelope', cost: { usd: 0.5, basis: 'reserved_ceiling' } },
      }),
      childAgent: null,
    });

    expect(card.result?.reasonText).toBe('It ended without saying whether the work was done.');
    expect(card.result?.isCostEstimated).toBe(true);
  });

  it('says a child stopped for no activity kept its work', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'timed_out',
        result: { reason: 'no_activity' },
      }),
      childAgent: null,
    });

    expect(card.result?.reasonText).toBe(
      'It showed no activity for 30 minutes and was stopped. Its work is kept.',
    );
  });

  it('reads a reason or an artifact kind that names an object key as an unknown word', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'x',
        role: 'scout',
        state: 'settled',
        outcome: 'failed',
        result: {
          reason: 'constructor',
          artifacts: [{ id: 'artifact-x', kind: 'toString', title: 'Odd one' }],
        },
      }),
      childAgent: null,
    });

    expect(card.result?.reasonText).toBeNull();
    expect(card.result?.artifacts[0]?.kind).toBe('toString');
  });

  it('is tolerant of a result it does not know', () => {
    const card = delegationCardOf({
      delegation: aDelegation({
        key: 'x',
        role: 'scout',
        state: 'settled',
        outcome: 'completed',
        result: 'text',
      }),
      childAgent: null,
    });

    expect(card.result).toBeNull();
  });

  it('says when the app changed the model Auto asked for', () => {
    const adjusted = delegationCardOf({
      delegation: aDelegation({
        key: 'x',
        role: 'scout',
        state: 'running',
        model: 'sonnet-5.5',
        routing: {
          proposal: 'adjusted',
          reason: 'not in the role set',
          requested: { provider: 'anthropic', model: 'opus-5.5' },
        },
      }),
      childAgent: null,
    });
    const kept = delegationCardOf({
      delegation: aDelegation({
        key: 'y',
        role: 'scout',
        state: 'running',
        routing: { proposal: 'kept' },
      }),
      childAgent: null,
    });

    expect(adjusted.routingNote).toBe(
      'Auto asked for Opus 5.5, used Sonnet 5.5: not in the role set',
    );
    expect(kept.routingNote).toBeNull();
  });

  it('titles a revision on the same producer, open and ready', () => {
    const open = delegationCardOf({
      delegation: aDelegation({
        key: 'p',
        role: 'planner',
        state: 'running',
        reviseOf: 'artifact-plan',
        baseRevision: 1,
      }),
      childAgent: null,
    });
    const done = delegationCardOf({
      delegation: aDelegation({
        key: 'p',
        role: 'planner',
        state: 'settled',
        outcome: 'completed',
        reviseOf: 'artifact-plan',
        baseRevision: 1,
      }),
      childAgent: null,
    });
    const failed = delegationCardOf({
      delegation: aDelegation({
        key: 'p',
        role: 'planner',
        state: 'settled',
        outcome: 'failed',
        reviseOf: 'artifact-plan',
        baseRevision: 1,
      }),
      childAgent: null,
    });

    expect(cardTitleOf({ card: open })).toBe('Planner, revising v2');
    expect(cardTitleOf({ card: done })).toBe('Planner, v2 ready');
    expect(cardTitleOf({ card: failed })).toBe('Planner');
  });
});

describe('batches, waiting text and composer line', () => {
  const settled = (key: string, at: number) =>
    aDelegation({ key, role: 'planner', state: 'settled', outcome: 'completed', settledAt: at });

  it('groups delegations by batch and anchors a batch on its last settle time', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        settled('a', 100),
        aDelegation({ key: 'b', role: 'implementer', state: 'running', batch: 'batch-2' }),
        aDelegation({ key: 'c', role: 'tester', state: 'accepted', batch: 'batch-2' }),
      ],
    });

    const batches = batchesOf({ view });

    expect(batches.map((batch) => [batch.key, batch.delegations.length, batch.beforeMs])).toEqual([
      ['batch-1', 1, 100],
      ['batch-2', 2, null],
    ]);
  });

  it('says what it waits for, and nothing once the tree is not waiting', () => {
    const waiting = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'b', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'c', role: 'tester', state: 'accepted' }),
      ],
    });

    expect(waitingTextOf({ view: waiting })).toBe('Waiting for Implementer and Tester');
    expect(waitingTextOf({ view: aView({ phase: 'merging' }) })).toBe(
      'Auto is reading the results',
    );
    expect(waitingTextOf({ view: aView({ phase: 'answering' }) })).toBeNull();
    expect(waitingTextOf({ view: aView({ phase: 'deciding' }) })).toBe('Deciding what to do next');
    expect(waitingTextOf({ view: aView({ phase: 'done' }) })).toBeNull();
    expect(
      waitingTextOf({ view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }) }),
    ).toBeNull();
  });

  it('queues the composer while Auto waits and points at the plan version while it needs approval', () => {
    const waiting = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'b', role: 'implementer', state: 'running' })],
    });

    expect(composerPlaceholderOf({ view: waiting })).toBe('Message Auto');
    expect(
      composerPlaceholderOf({
        view: aView({ phase: 'waiting', artifacts: [aPlanRow({ revision: 2 })] }),
      }),
    ).toBe('Message Auto, or describe changes to plan v2');
    expect(composerPlaceholderOf({ view: aView({ phase: 'answering' }) })).toBeUndefined();
  });
});

describe('artifactApprovalOf', () => {
  it('says Needs approval, Approved only for the revision that was approved, and Revising', () => {
    expect(artifactApprovalOf({ row: aPlanRow() })?.word).toBe('Needs approval');
    expect(
      artifactApprovalOf({
        row: aPlanRow({ approvalState: 'approved', approvedRevision: 1, revision: 1 }),
      })?.word,
    ).toBe('Approved');
    expect(
      artifactApprovalOf({
        row: aPlanRow({ approvalState: 'approved', approvedRevision: 1, revision: 2 }),
      })?.word,
    ).toBe('Needs approval');
    expect(
      artifactApprovalOf({ row: aPlanRow({ approvalState: 'revising', revision: 1 }) })?.word,
    ).toBe('Revising to v2');
  });
});
