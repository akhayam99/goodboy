import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import {
  applyDecisionOps,
  countDecisionChanges,
  isLedgerOverBudget,
  reconcileDecisionsText,
  renderDecisionsSlot,
  seedDecisionLedger,
  type DecisionActor,
  type DecisionOp,
} from './decisions-ledger';
import { extractDecisionOps } from './marker-parsing';

const SESSION = 'session' as SessionId;
const NOW = '2026-09-26T10:00:00.000Z' as IsoDateTime;
const LATER = '2026-09-26T11:00:00.000Z' as IsoDateTime;

const SUMMARIZER: DecisionActor = { author: 'summarizer', agentId: null, turnOrdinal: null };
const USER: DecisionActor = { author: 'user', agentId: null, turnOrdinal: null };
const IMPLEMENTER: DecisionActor = {
  author: 'agent',
  agentId: 'implementer' as AgentId,
  turnOrdinal: 9,
};

const idsFrom = (prefix: string) => {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
};

const seed = (lines: ReadonlyArray<string>): ReadonlyArray<SessionDecision> =>
  seedDecisionLedger({
    sessionId: SESSION,
    text: lines.map((line) => `- ${line}`).join('\n'),
    now: NOW,
    newId: idsFrom('seed'),
  });

type ApplyParams = {
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly ops: ReadonlyArray<DecisionOp>;
  readonly actor?: DecisionActor;
};

const apply = ({ ledger, ops, actor = SUMMARIZER }: ApplyParams) =>
  applyDecisionOps({ sessionId: SESSION, ledger, ops, actor, now: LATER, newId: idsFrom('op') });

const statusOf = (ledger: ReadonlyArray<SessionDecision>, number: number) =>
  ledger.find((row) => row.number === number)?.status;

describe('decision ledger', () => {
  it('numbers a seeded slot in its current order and renders the newest first', () => {
    const ledger = seed([
      'Fix only payments-api',
      'Return 200 on a duplicate delivery',
      'Key on the event id',
    ]);

    expect(ledger.map((row) => [row.number, row.text, row.author])).toEqual([
      [1, 'Fix only payments-api', 'summarizer'],
      [2, 'Return 200 on a duplicate delivery', 'summarizer'],
      [3, 'Key on the event id', 'summarizer'],
    ]);
    expect(renderDecisionsSlot({ ledger })).toBe(
      '- D3 Key on the event id\n- D2 Return 200 on a duplicate delivery\n- D1 Fix only payments-api',
    );
  });

  it('keeps a seeded code block as one decision', () => {
    const ledger = seedDecisionLedger({
      sessionId: SESSION,
      text: '- Use this key:\n  ```ts\n  const key = `stripe:${id}`\n  ```\n- Retry three times',
      now: NOW,
      newId: idsFrom('seed'),
    });

    expect(ledger).toHaveLength(2);
    expect(ledger[0]?.text).toContain('```ts');
  });

  it('leaves every decision nobody names exactly as it was', () => {
    const ledger = seed(['A', 'B', 'C', 'D', 'E', 'F']);
    const ops: ReadonlyArray<DecisionOp> = [
      { kind: 'reword', number: 2, text: 'B, reworded' },
      { kind: 'merge', numbers: [3, 4], text: 'C and D' },
      { kind: 'withdraw', number: 5, reason: 'No longer true' },
      { kind: 'add', text: 'G' },
    ];

    const result = apply({ ledger, ops });

    const named = new Set([2, 3, 4, 5]);
    for (const before of ledger) {
      if (named.has(before.number)) {
        continue;
      }
      expect(result.ledger.find((row) => row.number === before.number)).toBe(before);
    }
  });

  it('never removes a decision without an operation that names it', () => {
    const ledger = seed(['A', 'B', 'C']);
    const random = (() => {
      let state = 7;
      return () => {
        state = (state * 48_271) % 2_147_483_647;
        return state / 2_147_483_647;
      };
    })();
    let current = ledger;
    for (let round = 0; round < 60; round += 1) {
      const numbers = current.map((row) => row.number);
      const pick = () => numbers[Math.floor(random() * numbers.length)] ?? 1;
      const choice = Math.floor(random() * 5);
      const op: DecisionOp =
        choice === 0
          ? { kind: 'add', text: `Decision ${round}` }
          : choice === 1
            ? { kind: 'reword', number: pick(), text: `Reworded ${round}` }
            : choice === 2
              ? { kind: 'merge', numbers: [pick(), pick()], text: `Merged ${round}` }
              : choice === 3
                ? { kind: 'replace', number: pick(), text: `Replaced ${round}`, reason: 'Newer' }
                : { kind: 'withdraw', number: pick(), reason: random() > 0.5 ? 'Stale' : null };
      const result = apply({ ledger: current, ops: [op] });
      const removedNumbers = result.ledger
        .filter(
          (row) =>
            row.status !== 'active' &&
            current.find((before) => before.number === row.number)?.status === 'active',
        )
        .map((row) => row.number);
      for (const number of removedNumbers) {
        const named = op.kind === 'merge' ? op.numbers : 'number' in op ? [op.number] : [];
        expect(named).toContain(number);
      }
      for (const row of result.ledger) {
        if (row.status === 'withdrawn') {
          expect(row.reason).not.toBeNull();
        }
      }
      expect(result.ledger.length).toBeGreaterThanOrEqual(current.length);
      current = result.ledger;
    }
  });

  it('refuses a summarizer withdrawal or replacement without a reason', () => {
    const ledger = seed(['A', 'B']);

    const result = apply({
      ledger,
      ops: [
        { kind: 'withdraw', number: 1, reason: null },
        { kind: 'replace', number: 2, text: 'B2', reason: ' ' },
      ],
    });

    expect(result.rejected.map((rejection) => rejection.reason)).toEqual([
      'needs-reason',
      'needs-reason',
    ]);
    expect(result.ledger).toEqual(ledger);
  });

  it('keeps the lowest number on a merge and points the others at it', () => {
    const ledger = seed(['A', 'B', 'C']);

    const result = apply({ ledger, ops: [{ kind: 'merge', numbers: [3, 1], text: 'A and C' }] });

    const kept = result.ledger.find((row) => row.number === 1);
    expect(kept?.text).toBe('A and C');
    expect(kept?.previousText).toBe('A');
    expect(result.ledger.find((row) => row.number === 3)).toMatchObject({
      status: 'replaced',
      replacedBy: 1,
    });
    expect(result.changes).toEqual([{ kind: 'merged', number: 3, into: 1, text: 'C' }]);
  });

  it('replaces a decision with a new number and keeps the reason', () => {
    const ledger = seed(['Show the banner after the first failed retry']);

    const result = apply({
      ledger,
      actor: IMPLEMENTER,
      ops: [
        {
          kind: 'replace',
          number: 1,
          text: 'Show the banner after the third failed retry',
          reason: 'You answered: three retries',
        },
      ],
    });

    expect(result.ledger.find((row) => row.number === 2)).toMatchObject({
      author: 'agent',
      agentId: 'implementer',
      turnOrdinal: 9,
      status: 'active',
    });
    expect(result.ledger.find((row) => row.number === 1)).toMatchObject({
      status: 'replaced',
      replacedBy: 2,
      reason: 'You answered: three retries',
      closedBy: 'agent',
    });
  });

  it('never brings back a decision you withdrew from a marker with the same text', () => {
    const ledger = seed(['Use sqlite']);
    const withdrawn = apply({
      ledger,
      actor: USER,
      ops: [{ kind: 'withdraw', number: 1, reason: null }],
    }).ledger;

    const result = apply({
      ledger: withdrawn,
      actor: IMPLEMENTER,
      ops: [{ kind: 'add', text: '- use SQLite.' }],
    });

    expect(result.rejected[0]?.reason).toBe('tomb');
    expect(result.ledger.filter((row) => row.status === 'active')).toEqual([]);
  });

  it('dedupes an addition against an active decision after normalizing', () => {
    const ledger = seed(['Use `sqlite` for the cache']);

    const result = apply({
      ledger,
      actor: IMPLEMENTER,
      ops: [{ kind: 'add', text: '* use sqlite   for the cache.' }],
    });

    expect(result.rejected[0]?.reason).toBe('duplicate');
  });

  it('never lets the summarizer reword, merge or withdraw what you wrote', () => {
    const ledger = apply({
      ledger: seed(['A', 'B']),
      actor: USER,
      ops: [{ kind: 'reword', number: 1, text: 'A, in my words' }],
    }).ledger;

    const result = apply({
      ledger,
      ops: [
        { kind: 'reword', number: 1, text: 'A again' },
        { kind: 'merge', numbers: [1, 2], text: 'A and B' },
        { kind: 'withdraw', number: 1, reason: 'Stale' },
        { kind: 'replace', number: 1, text: 'A2', reason: 'The plan changed' },
      ],
    });

    expect(result.rejected.map((rejection) => rejection.reason)).toEqual([
      'user-owned',
      'user-owned',
      'user-owned',
    ]);
    expect(statusOf(result.ledger, 1)).toBe('replaced');
  });

  it('marks a summarizer reword so the drawer can show the previous text', () => {
    const result = apply({
      ledger: seed(['Use event.id as idempotency key']),
      ops: [{ kind: 'reword', number: 1, text: 'Key idempotency on the provider event id' }],
    });

    expect(result.ledger[0]).toMatchObject({
      previousText: 'Use event.id as idempotency key',
      rewordedAt: LATER,
      author: 'summarizer',
    });
    expect(countDecisionChanges({ changes: result.changes }).added).toBe(0);
  });

  it('restores a withdrawn decision only for you', () => {
    const withdrawn = apply({
      ledger: seed(['A']),
      actor: USER,
      ops: [{ kind: 'withdraw', number: 1, reason: null }],
    }).ledger;

    expect(apply({ ledger: withdrawn, ops: [{ kind: 'restore', number: 1 }] }).rejected).toEqual([
      { op: { kind: 'restore', number: 1 }, reason: 'user-only' },
    ]);
    expect(
      statusOf(
        apply({ ledger: withdrawn, actor: USER, ops: [{ kind: 'restore', number: 1 }] }).ledger,
        1,
      ),
    ).toBe('active');
  });

  it('turns an edited slot into operations of yours', () => {
    const ledger = seed(['A', 'B', 'C']);

    const ops = reconcileDecisionsText({
      ledger,
      text: '- New one\n- D3 C, sharper\n- B\n',
    });

    expect(ops).toEqual([
      { kind: 'reword', number: 3, text: 'C, sharper' },
      { kind: 'add', text: 'New one' },
      { kind: 'withdraw', number: 1, reason: null },
    ]);
  });

  it('reports a list over budget', () => {
    const ledger = seed(
      Array.from({ length: 40 }, (_, index) => `Decision number ${index} `.repeat(3)),
    );

    expect(isLedgerOverBudget({ ledger })).toBe(true);
    expect(isLedgerOverBudget({ ledger: seed(['A']) })).toBe(false);
  });
});

describe('decision markers', () => {
  it('reads additions, replacements and withdrawals', () => {
    const ops = extractDecisionOps(
      [
        '<<ctx-decision>>Key on the event id<</ctx-decision>>',
        '<<ctx-decision replaces="D3" reason="payload changes">>Key on id and provider<</ctx-decision>>',
        '<<ctx-decision withdraw="D5">>The ledger already keeps retry state<</ctx-decision>>',
        '<<ctx-decision withdraw="D6">><</ctx-decision>>',
      ].join('\n'),
    );

    expect(ops).toEqual([
      { kind: 'add', text: 'Key on the event id' },
      { kind: 'replace', number: 3, text: 'Key on id and provider', reason: 'payload changes' },
      { kind: 'withdraw', number: 5, reason: 'The ledger already keeps retry state' },
    ]);
  });
});
