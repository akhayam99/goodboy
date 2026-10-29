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

type FactsParams = {
  readonly verified: unknown;
  readonly summary: string;
};

const factsRowOf = ({ verified, summary }: FactsParams): AutoOutboxRow => ({
  ...rowOf({ artifacts: [] }),
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
        declared: { summary },
        verified,
        artifacts: [],
      },
    ],
  },
});

describe('deliveredResultsOf outcome line', () => {
  it('turns a model Done into the red outcome when a check failed', () => {
    const [result] = deliveredResultsOf({
      accepted: [
        factsRowOf({
          summary: '<<outcome>>Done<</outcome>>',
          verified: {
            checks: [{ name: 'unit tests', status: 'fail', source: 'harness' }],
            checksRun: { verdict: 'red', reason: null, commit: null },
          },
        }),
      ],
    });

    expect(result?.outcomeLine).toMatchObject({ text: 'Checks failed: 1', tone: 'danger' });
  });

  it('turns a model Done into the red outcome when the push failed', () => {
    const [result] = deliveredResultsOf({
      accepted: [
        factsRowOf({
          summary: '<<outcome>>Done<</outcome>>',
          verified: { publish: { state: 'failed', mode: 'push', branch: 'ak/ledger-core' } },
        }),
      ],
    });

    expect(result?.outcomeLine?.tone).toBe('danger');
    expect(result?.outcomeLine?.text).not.toBe('Done');
  });

  it('keeps the model line when the facts agree', () => {
    const [result] = deliveredResultsOf({
      accepted: [
        factsRowOf({
          summary: '<<outcome>>Posted the credit once<</outcome>>',
          verified: { checksRun: { verdict: 'green', reason: null, commit: null } },
        }),
      ],
    });

    expect(result?.outcomeLine).toMatchObject({ text: 'Posted the credit once', tone: 'success' });
  });
});
