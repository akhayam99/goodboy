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
  it('names the role, the model, the reason and the ceiling of a running child', () => {
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
      ceilingUsd: 3,
      result: null,
    });
    expect(card.reason).toContain('idempotency');
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
        model: 'sonnet',
        routing: {
          proposal: 'adjusted',
          reason: 'not in the role set',
          requested: { model: 'opus' },
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

    expect(adjusted.routingNote).toBe('Auto asked for opus, used sonnet: not in the role set');
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
