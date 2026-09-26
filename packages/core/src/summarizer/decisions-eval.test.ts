import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import {
  applyDecisionOps,
  countDecisionChanges,
  hasVisibleDecisionChange,
  isLedgerOverBudget,
  seedDecisionLedger,
  type DecisionActor,
} from '../context/decisions-ledger';
import { extractDecisionOps } from '../context/marker-parsing';
import {
  Summarizer,
  SummarizerParseError,
  type SummarizeMode,
  type SummarizerDeps,
} from './client';

const SESSION = 'session_eval' as SessionId;
const NOW = '2026-09-26T10:00:00.000Z' as IsoDateTime;
const SUMMARIZER: DecisionActor = { author: 'summarizer', agentId: null, turnOrdinal: null };

const idsFrom = (prefix: string) => {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
};

const ledgerOf = (lines: ReadonlyArray<string>): ReadonlyArray<SessionDecision> =>
  seedDecisionLedger({
    sessionId: SESSION,
    text: lines.map((line) => `- ${line}`).join('\n'),
    now: NOW,
    newId: idsFrom('seed'),
  });

type PassParams = {
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly response: unknown;
  readonly mode?: SummarizeMode;
};

const pass = async ({ ledger, response, mode = 'turn' }: PassParams) => {
  const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> =>
    ({ stdout: JSON.stringify(response), stderr: '', exitCode: 0 }) as T;
  const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });
  const result = await summarizer.summarize({
    prevSlots: [],
    decisions: ledger,
    turnInput: 'q',
    turnOutput: 'a',
    mode,
  });
  const applied = applyDecisionOps({
    sessionId: SESSION,
    ledger,
    ops: result.delta.decisionOps,
    actor: SUMMARIZER,
    now: NOW,
    newId: idsFrom('pass'),
  });
  return { delta: result.delta, applied };
};

const active = (ledger: ReadonlyArray<SessionDecision>) =>
  ledger.filter((row) => row.status === 'active').map((row) => [row.number, row.text]);

describe('decisions eval', () => {
  it('a rewording keeps the number and is not a change in Activity', async () => {
    const ledger = ledgerOf([
      'Use event.id as idempotency key because payload differs per retry',
      'Return 200 on a duplicate delivery',
    ]);

    const { applied } = await pass({
      ledger,
      response: {
        upserts: [],
        decisionOps: [
          {
            op: 'reword',
            id: 'D1',
            text: 'Key idempotency on the provider event id; the payload changes between retries',
          },
        ],
      },
    });

    expect(active(applied.ledger).map(([number]) => number)).toEqual([1, 2]);
    expect(hasVisibleDecisionChange({ changes: applied.changes })).toBe(false);
    expect(applied.ledger[0]?.previousText).toBe(
      'Use event.id as idempotency key because payload differs per retry',
    );
  });

  it('a merge folds near-duplicates into the lowest number', async () => {
    const ledger = ledgerOf([
      'Use jwt for auth',
      'Keep processed event ids for 30 days',
      'Use jwt tokens for authentication',
    ]);

    const { applied } = await pass({
      ledger,
      response: {
        upserts: [],
        decisionOps: [{ op: 'merge', ids: ['D3', 'D1'], text: 'Use jwt for auth' }],
      },
    });

    expect(active(applied.ledger)).toEqual([
      [1, 'Use jwt for auth'],
      [2, 'Keep processed event ids for 30 days'],
    ]);
    expect(countDecisionChanges({ changes: applied.changes }).merged).toBe(1);
  });

  it('a contradiction replaces the older decision with a reason', async () => {
    const ledger = ledgerOf(['Show the banner after the first failed retry']);

    const { applied } = await pass({
      ledger,
      response: {
        upserts: [],
        decisionOps: [
          {
            op: 'replace',
            id: 'D1',
            text: 'Show the banner after the third failed retry',
            reason: 'One failed retry is normal provider noise',
          },
        ],
      },
    });

    expect(active(applied.ledger)).toEqual([[2, 'Show the banner after the third failed retry']]);
    expect(applied.ledger[0]).toMatchObject({
      status: 'replaced',
      replacedBy: 2,
      reason: 'One failed retry is normal provider noise',
    });
  });

  it('state dressed as a decision, with no why, never enters the ledger', async () => {
    const ledger = ledgerOf(['Return 200 on a duplicate delivery']);

    const { delta, applied } = await pass({
      ledger,
      response: {
        upserts: [
          {
            key: 'last_output_summary',
            value:
              '#### Learned\n- none\n\n#### State\n- Verified: 42 tests pass\n\n#### Next\n- ship',
          },
        ],
        decisionOps: [{ op: 'add', text: 'Verified: 42 tests pass' }],
      },
    });

    expect(delta.decisionOps).toEqual([]);
    expect(active(applied.ledger)).toEqual([[1, 'Return 200 on a duplicate delivery']]);
    expect(delta.upserts[0]?.value).toContain('Verified: 42 tests pass');
  });

  it('an Italian marker is translated in place, not removed and added again', async () => {
    const seeded = ledgerOf(['Return 200 on a duplicate delivery']);
    const marker = applyDecisionOps({
      sessionId: SESSION,
      ledger: seeded,
      ops: extractDecisionOps(
        '<<ctx-decision>>Tenere gli id degli eventi per 30 giorni<</ctx-decision>>',
      ),
      actor: { author: 'agent', agentId: null, turnOrdinal: 4 },
      now: NOW,
      newId: idsFrom('marker'),
    }).ledger;

    const { applied } = await pass({
      ledger: marker,
      response: {
        upserts: [],
        decisionOps: [{ op: 'reword', id: 'D2', text: 'Keep processed event ids for 30 days' }],
      },
    });

    expect(active(applied.ledger)).toEqual([
      [1, 'Return 200 on a duplicate delivery'],
      [2, 'Keep processed event ids for 30 days'],
    ]);
    expect(hasVisibleDecisionChange({ changes: applied.changes })).toBe(false);
  });

  it('a list over budget is consolidated with reasons, never cut', async () => {
    const lines = Array.from(
      { length: 24 },
      (_, index) => `Decision ${index + 1}: keep the retry ledger consistent across payments-api`,
    );
    const ledger = ledgerOf(lines);
    expect(isLedgerOverBudget({ ledger })).toBe(true);

    const merges = Array.from({ length: 8 }, (_, index) => ({
      op: 'merge',
      ids: [`D${index * 3 + 1}`, `D${index * 3 + 2}`, `D${index * 3 + 3}`],
      text: `Group ${index + 1}: keep the retry ledger consistent`,
    }));
    const { delta, applied } = await pass({
      ledger,
      mode: 'consolidate',
      response: {
        upserts: [],
        decisionOps: [
          ...merges,
          { op: 'withdraw', id: 'D22', reason: 'Covered by group 8' },
          { op: 'add', text: 'A new decision', why: 'not allowed while consolidating' },
          { op: 'reword', id: 'D1', text: 'not allowed while consolidating' },
        ],
      },
    });

    expect(delta.decisionOps.every((op) => op.kind === 'merge' || op.kind === 'withdraw')).toBe(
      true,
    );
    expect(isLedgerOverBudget({ ledger: applied.ledger })).toBe(false);
    expect(applied.ledger.filter((row) => row.status === 'active')).toHaveLength(7);
    expect(
      applied.ledger
        .filter((row) => row.status === 'withdrawn')
        .every((row) => row.reason !== null),
    ).toBe(true);
  });

  it('a pass that names no decision loses none', async () => {
    const ledger = ledgerOf(Array.from({ length: 14 }, (_, index) => `Decision ${index + 1}`));

    const { applied } = await pass({ ledger, response: { upserts: [] } });

    expect(applied.ledger).toEqual(ledger);
  });

  it('asks again when the operations do not follow the schema', async () => {
    await expect(
      pass({
        ledger: ledgerOf(['A']),
        response: { upserts: [], decisionOps: [{ op: 'withdraw', reason: 'stale' }] },
      }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });
});
