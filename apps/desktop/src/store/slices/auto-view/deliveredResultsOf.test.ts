import { describe, expect, it } from 'vitest';
import type { AutoOutboxRow } from '@goodboy/db';
import { brandId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import { deliveredResultsOf } from './deliveredResultsOf';

type EntryParams = {
  readonly artifacts: unknown;
};

const rowOf = ({ artifacts }: EntryParams): AutoOutboxRow => ({
  id: brandId<AutoOutboxId>({ value: 'outbox-results-1' }),
  treeId: brandId<AutoTreeId>({ value: 'tree-harborline' }),
  generation: 1,
  kind: 'results',
  joinKey: 'batch-1',
  payload: {
    kind: 'results',
    batchId: 'batch-1',
    results: [
      {
        delegationId: 'delegation-reviewer',
        childAgentId: 'agent-reviewer',
        role: 'reviewer',
        outcome: 'completed',
        routing: { provider: 'anthropic', model: 'sonnet' },
        declared: { summary: 'Comparing the branch.' },
        artifacts,
      },
    ],
  },
  payloadJson: '{}',
  state: 'accepted',
  claimedBy: null,
  claimExpiresAt: null,
  acceptedRunId: 'run-auto-2',
  droppedReason: null,
  createdAt: 1,
});

describe('deliveredResultsOf artifacts', () => {
  it('carries the artifacts a child produced', () => {
    const [result] = deliveredResultsOf({
      accepted: [
        rowOf({
          artifacts: [
            { id: 'artifact-report', kind: 'report', title: 'Certify ledger-core', revision: 2 },
          ],
        }),
      ],
    });

    expect(result?.artifacts).toEqual([
      { artifactId: 'artifact-report', kind: 'report', title: 'Certify ledger-core', revision: 2 },
    ]);
  });

  it('skips an entry without an id or a title and reads a missing list as none', () => {
    const [broken] = deliveredResultsOf({
      accepted: [rowOf({ artifacts: [{ kind: 'report', title: 'No id' }, { id: 'a' }] })],
    });
    const [missing] = deliveredResultsOf({ accepted: [rowOf({ artifacts: undefined })] });

    expect(broken?.artifacts).toEqual([]);
    expect(missing?.artifacts).toEqual([]);
  });
});
