import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoSpawnedRowsOf } from '../../../app/components/SpawnedPanel/autoSpawnedRowsOf';
import { aDelegation, aView } from '../testing/autoViewFixtures';
import { railRowsOf } from './railRowsOf';

const words = vi.hoisted(() => ({ isRenamed: false }));

vi.mock('./settledStatusOf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settledStatusOf')>();
  return {
    ...actual,
    settledStatusOf: (params: Parameters<typeof actual.settledStatusOf>[0]) => {
      const status = actual.settledStatusOf(params);
      return words.isRenamed ? { ...status, word: `Renamed ${status.word}` } : status;
    },
  };
});

afterEach(() => {
  words.isRenamed = false;
});

const DELEGATIONS = [
  aDelegation({
    key: 'planner',
    role: 'planner',
    state: 'settled',
    outcome: 'completed',
    settledAt: 5,
  }),
  aDelegation({ key: 'impl', role: 'implementer', state: 'running', batch: 'batch-2' }),
  aDelegation({ key: 'test', role: 'tester', state: 'accepted', batch: 'batch-2' }),
];

const ROOT_ROUTING = { provider: 'anthropic', model: 'opus', effort: 'medium' } as const;

describe('railRowsOf substeps', () => {
  it('draws a substep one level under the child that waits for it', () => {
    const helper = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'running', batch: 'batch-3' }),
      request: {
        task: 'find the retry limit',
        parent: { delegationId: 'delegation-impl', questionId: 'question-1', depth: 2 },
      },
    };
    const view = aView({ phase: 'waiting', delegations: [...DELEGATIONS, helper] });

    const rows = railRowsOf({ view, agents: [], rootRouting: ROOT_ROUTING });

    expect(rows.map((row) => [row.label, row.depth])).toEqual([
      ['Auto', 0],
      ['work for planner', 1],
      ['work for impl', 1],
      ['find the retry limit', 2],
      ['work for test', 1],
    ]);
    const tree = autoSpawnedRowsOf({ rows, baseLevel: 1 });
    expect(tree.map((row) => [row.title, row.level, row.hasChildren])).toEqual([
      ['Auto', 1, true],
      ['work for planner', 2, false],
      ['work for impl', 2, true],
      ['find the retry limit', 3, false],
      ['work for test', 2, false],
    ]);
  });

  it('keeps a substep as a plain child when its parent is not in the tree', () => {
    const orphan = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'running', batch: 'batch-3' }),
      request: {
        task: 'find it',
        parent: { delegationId: 'delegation-gone', questionId: 'question-1', depth: 2 },
      },
    };
    const view = aView({ phase: 'waiting', delegations: [orphan] });

    const rows = railRowsOf({ view, agents: [], rootRouting: ROOT_ROUTING });

    expect(rows.map((row) => row.depth)).toEqual([0, 1]);
  });

  it('orders the children by when Auto started them, so a number left matches the order', () => {
    const at = (key: string, createdAt: number) => ({
      ...aDelegation({ key, role: 'implementer', state: 'running' }),
      request: {},
      createdAt,
    });
    const view = aView({
      phase: 'waiting',
      delegations: [at('fourth', 40), at('third', 30), at('eleventh', 110), at('tenth', 100)],
    });

    const rows = railRowsOf({ view, agents: [], rootRouting: ROOT_ROUTING });

    expect(rows.map((row) => row.label)).toEqual([
      'Auto',
      'Implementer 1',
      'Implementer 2',
      'Implementer 3',
      'Implementer 4',
    ]);
    expect(rows.slice(1).map((row) => row.agentId)).toEqual([
      'agent-third',
      'agent-fourth',
      'agent-tenth',
      'agent-eleventh',
    ]);
  });
});

describe('railRowsOf nodes', () => {
  const settled = (['completed', 'failed', 'timed_out', 'blocked', 'stopped'] as const).map(
    (outcome) => aDelegation({ key: outcome, role: 'implementer', state: 'settled', outcome }),
  );
  const nodesOf = () =>
    railRowsOf({
      view: aView({ phase: 'waiting', delegations: settled }),
      agents: [],
      rootRouting: ROOT_ROUTING,
    })
      .slice(1)
      .map((row) => [row.agentId, row.node]);

  it('draws each settled outcome with its own node', () => {
    expect(nodesOf()).toEqual([
      ['agent-completed', 'done'],
      ['agent-failed', 'failed'],
      ['agent-timed_out', 'failed'],
      ['agent-blocked', 'skipped'],
      ['agent-stopped', 'stopped'],
    ]);
  });

  it('keeps every node when the status words are renamed', () => {
    const before = nodesOf();

    words.isRenamed = true;

    expect(nodesOf()).toEqual(before);
  });
});
