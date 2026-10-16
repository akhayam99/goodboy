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
const SUMMARY = { done: ['Found the slow query'], left: ['Stream rows to CSV'] };

describe('orchestratedChecklistOf', () => {
  it('puts a read hint before the step that read it, once per step', () => {
    const list = orchestratedChecklistOf({
      agents: [SECOND, FIRST],
      hints: [hintOf({ key: 'a', step: 2 }), hintOf({ key: 'b', step: 2 }), hintOf({ key: 'c' })],
      summary: SUMMARY,
      isDeciding: false,
      isDone: false,
    });
    expect(list.readHintsBefore.get(SECOND.id)).toEqual([2]);
    expect(list.readHintsBefore.get(FIRST.id)).toBeUndefined();
    expect(list.trailingHintSteps).toEqual([]);
  });

  it('keeps a hint read by a step not on the list yet at the end', () => {
    const list = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [hintOf({ key: 'a', step: 2 })],
      summary: null,
      isDeciding: true,
      isDone: false,
    });
    expect(list.trailingHintSteps).toEqual([2]);
    expect(list.isNextShown).toBe(true);
    expect(list.left).toEqual([]);
  });

  it('lists the Left items while the run lives and leaves them to the result once done', () => {
    const live = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [],
      summary: SUMMARY,
      isDeciding: false,
      isDone: false,
    });
    expect(live.left).toEqual(['Stream rows to CSV']);
    const done = orchestratedChecklistOf({
      agents: [FIRST],
      hints: [],
      summary: SUMMARY,
      isDeciding: false,
      isDone: true,
    });
    expect(done.left).toEqual([]);
  });
});
