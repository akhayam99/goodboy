// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Work } from '../../../live-state/workOf';
import { NOW_LIMIT, nowRowsOf } from './nowRowsOf';

type WorkParams = {
  readonly agentId: string;
  readonly phrase: string;
};

const workOf = ({ agentId, phrase }: WorkParams): Work => ({
  runId: `run-${agentId}`,
  sessionId: 'session-hbl-412',
  agentId,
  mountId: 'mount-api',
  workflowRunId: null,
  place: { kind: 'project', name: 'payments-api' },
  phrase,
  startedAt: 1_000,
  quietMs: null,
});

const NOUNS = new Map([
  ['a1', 'Implementer'],
  ['a2', 'Tester'],
  ['a3', 'Reviewer'],
  ['a4', 'Debugger'],
]);

describe('nowRowsOf', () => {
  it('shows at most three agents with a live turn and counts the rest', () => {
    const work = ['a1', 'a2', 'a3', 'a4'].map((agentId) =>
      workOf({ agentId, phrase: `Editing ${agentId}.ts` }),
    );
    const model = nowRowsOf({ groups: [], work, writerWaits: [], nounById: NOUNS });
    expect(model.shown).toHaveLength(NOW_LIMIT);
    expect(model.moreCount).toBe(1);
    expect(model.shown[0]).toEqual({
      agentId: 'a1',
      depth: 0,
      who: 'Implementer',
      place: 'payments-api',
      phrase: 'Editing a1.ts',
      startedAt: 1_000,
    });
  });

  it('is empty when nothing runs', () => {
    const model = nowRowsOf({ groups: [], work: [], writerWaits: [], nounById: NOUNS });
    expect(model.shown).toEqual([]);
    expect(model.moreCount).toBe(0);
    expect(model.waits).toEqual([]);
  });

  it('turns an agent that waits for a file into a hot wait line, never a live row', () => {
    const work = [
      workOf({ agentId: 'a1', phrase: 'Editing state.ts' }),
      workOf({ agentId: 'a2', phrase: 'No tool call yet' }),
    ];
    const model = nowRowsOf({
      groups: [],
      work,
      writerWaits: [{ agentId: 'a2', path: 'src/retry/state.ts', blockedBy: 'a1', since: 500 }],
      nounById: NOUNS,
    });
    expect(model.shown.map((row) => row.agentId)).toEqual(['a1']);
    expect(model.waits).toEqual([
      {
        id: 'writer:a2',
        text: 'Tester waits on src/retry/state.ts, held by the Implementer',
        isHot: true,
        since: 500,
      },
    ]);
  });
});
