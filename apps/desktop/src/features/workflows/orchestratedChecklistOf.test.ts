// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { orchestratedChecklistOf } from './orchestratedChecklistOf';

const AT: IsoDateTime = JSON.parse('"2026-10-16T15:00:00.000Z"');

type AgentParams = {
  readonly key: string;
  readonly ordinal: number;
};

const stepOf = ({ key, ordinal }: AgentParams): Agent => ({
  id: JSON.parse(`"mock-list-${key}"`),
  sessionId: JSON.parse('"mock-list-session"'),
  ordinal,
  name: key,
  kind: 'scout',
  status: 'completed',
});

type HintParams = {
  readonly key: string;
  readonly step?: number;
};

const hintOf = ({ key, step }: HintParams): OrchestratorHint => ({
  id: key,
  text: key,
  createdAt: AT,
  ...(step === undefined ? {} : { consumedAt: AT, consumedAtStep: step }),
});

const FIRST = stepOf({ key: 'first', ordinal: 0 });
const SECOND = stepOf({ key: 'second', ordinal: 1 });
const SUMMARY = {
  done: ['Found the slow query'],
  left: ['Prove the batching', 'Stream rows to CSV'],
  leftRoles: { 'Prove the batching': 'tester' },
} satisfies Parameters<typeof orchestratedChecklistOf>[0]['summary'];

describe('orchestratedChecklistOf', () => {
  it('puts each read hint before the step that read it, in the order read', () => {
    const list = orchestratedChecklistOf({
      agents: [SECOND, FIRST],
      hints: [hintOf({ key: 'a', step: 2 }), hintOf({ key: 'b', step: 2 }), hintOf({ key: 'c' })],
      summary: SUMMARY,
      isDeciding: false,
      isDone: false,
    });
    expect(list.readHintsBefore.get(SECOND.id)?.map((hint) => hint.id)).toEqual(['a', 'b']);
    expect(list.readHintsBefore.get(FIRST.id)).toBeUndefined();
    expect(list.trailingHints).toEqual([]);
  });

  it('keeps a hint read by a step not on the list yet at the end', () => {
    const list = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [hintOf({ key: 'a', step: 2 })],
      summary: null,
      isDeciding: true,
      isDone: false,
    });
    expect(list.trailingHints.map((hint) => hint.id)).toEqual(['a']);
    expect(list.isNextShown).toBe(true);
    expect(list.left).toEqual([]);
  });

  it('sends a hint read with no recorded step to the trailing hints, after the stepped ones', () => {
    const legacy: OrchestratorHint = {
      id: 'legacy',
      text: 'legacy',
      createdAt: AT,
      consumedAt: AT,
    };
    const list = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [legacy, hintOf({ key: 'a', step: 2 }), hintOf({ key: 'queued' })],
      summary: null,
      isDeciding: false,
      isDone: false,
    });
    expect(list.trailingHints.map((hint) => hint.id)).toEqual(['a', 'legacy']);
    expect(list.readHintsBefore.size).toBe(0);
  });

  it('lists the Left items while the run lives and leaves them to the result once done', () => {
    const live = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [],
      summary: SUMMARY,
      isDeciding: false,
      isDone: false,
    });
    expect(live.left).toEqual([{ text: 'Prove the batching', role: 'tester' }]);
    const done = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [],
      summary: SUMMARY,
      isDeciding: false,
      isDone: true,
    });
    expect(done.left).toEqual([]);
    expect(done.notes).toEqual([]);
  });

  it('keeps a Left item with no role out of the steps and lists it as a note', () => {
    const list = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [],
      summary: SUMMARY,
      isDeciding: false,
      isDone: false,
    });
    expect(list.left.map((item) => item.text)).toEqual(['Prove the batching']);
    expect(list.notes).toEqual(['Stream rows to CSV']);
  });

  it('shows a planned step once when it repeats the name of a step that already exists', () => {
    const verify = { ...FIRST, name: 'Verify the checks and open the draft PR' };
    const list = orchestratedChecklistOf({
      agents: [verify],
      hints: [],
      summary: {
        done: [],
        left: [
          'verify the checks, and open the draft PR.',
          'Prove the batching',
          'Prove the  batching',
        ],
        leftRoles: {
          'verify the checks, and open the draft PR.': 'implementer',
          'Prove the batching': 'tester',
          'Prove the  batching': 'tester',
        },
      },
      isDeciding: false,
      isDone: false,
    });
    expect(list.left.map((item) => item.text)).toEqual(['Prove the batching']);
    expect(list.notes).toEqual([]);
  });

  it('drops a roleless note that repeats a done step word for word', () => {
    const verify = { ...FIRST, name: 'Verify the checks and open the draft PR' };
    const list = orchestratedChecklistOf({
      agents: [verify],
      hints: [],
      summary: {
        done: [],
        left: ['Verify the checks and open the draft PR'],
        leftRoles: {},
      },
      isDeciding: false,
      isDone: false,
    });
    expect(list.notes).toEqual([]);
  });

  it('never hides unfinished work that only looks like a step that exists', () => {
    const logging = { ...FIRST, name: 'Enable logging' };
    const payments = { ...SECOND, name: 'Add tests for valid payments' };
    const list = orchestratedChecklistOf({
      agents: [logging, payments],
      hints: [],
      summary: {
        done: [],
        left: ['Disable logging', 'Add tests for invalid payments', 'Prove the batching again'],
        leftRoles: {
          'Disable logging': 'implementer',
          'Add tests for invalid payments': 'tester',
        },
      },
      isDeciding: false,
      isDone: false,
    });
    expect(list.left.map((item) => item.text)).toEqual([
      'Disable logging',
      'Add tests for invalid payments',
    ]);
    expect(list.notes).toEqual(['Prove the batching again']);
  });
});
