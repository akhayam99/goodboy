import { describe, expect, it } from 'vitest';
import { autoSpawnedRowsOf } from '../../../app/components/SpawnedPanel/autoSpawnedRowsOf';
import { aDelegation, aView } from '../testing/autoViewFixtures';
import { railRowsOf } from './railRowsOf';

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
      ['Planner', 1],
      ['Implementer', 1],
      ['Scout', 2],
      ['Tester', 1],
    ]);
    const tree = autoSpawnedRowsOf({ rows, baseLevel: 1 });
    expect(tree.map((row) => [row.title, row.level, row.hasChildren])).toEqual([
      ['Auto', 1, true],
      ['Planner', 2, false],
      ['Implementer', 2, true],
      ['Scout', 3, false],
      ['Tester', 2, false],
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
});
