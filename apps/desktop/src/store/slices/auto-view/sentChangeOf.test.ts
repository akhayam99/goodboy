import { describe, expect, it } from 'vitest';
import { EMPTY_USER_FACTS } from '@goodboy/core/auto';
import type { AutoOutboxRow, AutoTree } from '@goodboy/db';
import { brandId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import { aTree } from '../../../features/auto/testing/autoViewFixtures';
import { sentChangeOf } from './sentChangeOf';

const CHANGE = { artifactId: 'plan-1', baseRevision: 1, commentIds: [] };

type RowParams = {
  readonly id: string;
  readonly state: AutoOutboxRow['state'];
  readonly isChange?: boolean;
  readonly acceptedRunId?: string | null;
  readonly generation?: number;
  readonly createdAt?: number;
};

const rowOf = ({
  id,
  state,
  isChange = true,
  acceptedRunId = null,
  generation = 1,
  createdAt = 1,
}: RowParams): AutoOutboxRow => {
  const payload = {
    kind: 'user',
    text: 'follow the guidelines',
    facts: { ...EMPTY_USER_FACTS, explicitChange: isChange ? CHANGE : null },
  };
  return {
    id: brandId<AutoOutboxId>({ value: id }),
    treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
    generation,
    kind: 'user',
    joinKey: `user:${id}`,
    payload,
    payloadJson: JSON.stringify(payload),
    state,
    claimedBy: null,
    claimExpiresAt: null,
    acceptedRunId,
    droppedReason: null,
    createdAt,
  };
};

type TreeParams = {
  readonly activeRunId?: string | null;
};

const tree = ({ activeRunId = null }: TreeParams = {}): AutoTree => ({
  ...aTree({ phase: 'deciding' }),
  generation: 1,
  activeRunId,
});

describe('sentChangeOf', () => {
  it('names the plan version of a change that waits for the Lead', () => {
    expect(sentChangeOf({ tree: tree(), rows: [rowOf({ id: 'a', state: 'pending' })] })).toEqual({
      artifactId: 'plan-1',
      revision: 1,
    });
  });

  it('keeps it while the Lead reads it in its turn, and lets go once that turn is over', () => {
    const rows = [rowOf({ id: 'a', state: 'accepted', acceptedRunId: 'run-1' })];

    expect(sentChangeOf({ tree: tree({ activeRunId: 'run-1' }), rows })).not.toBeNull();
    expect(sentChangeOf({ tree: tree({ activeRunId: null }), rows })).toBeNull();
  });

  it.each([
    ['a plain message', rowOf({ id: 'a', state: 'pending', isChange: false })],
    ['an older generation', rowOf({ id: 'a', state: 'pending', generation: 0 })],
    ['a dropped message', rowOf({ id: 'a', state: 'dropped' })],
  ])('names nothing for %s', (_name, row) => {
    expect(sentChangeOf({ tree: tree(), rows: [row] })).toBeNull();
  });
});
