import { describe, expect, it } from 'vitest';
import { buildArtifactLedgerBlock, sha256Hex } from '@goodboy/core';
import { writeArtifactRevision } from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import { approveArtifact } from './approveArtifact';
import { treeArtifacts } from './treeArtifacts';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  planRef,
  registerPlan,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';

const plan1 = brandId<ArtifactId>({ value: 'plan-1' });
const plan2 = brandId<ArtifactId>({ value: 'plan-2' });

const world = async (): Promise<AutoWorld> => {
  const created = await makeAutoWorld({
    agentIds: ['agent-planner'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-2', agentId: 'agent-planner' },
    ],
  });
  await registerPlan({ world: created, id: 'plan-1', agentId: 'agent-planner' });
  await registerPlan({ world: created, id: 'plan-2', agentId: 'agent-planner' });
  return created;
};

type EditParams = {
  readonly world: AutoWorld;
  readonly id: ArtifactId;
  readonly revision: number;
};

const handEdit = ({ world: target, id, revision }: EditParams) =>
  writeArtifactRevision({
    db: target.db,
    artifactId: id,
    expectedRevision: revision,
    author: 'user',
    ask: 'tighten step one',
    title: 'Plan for notify-relay',
    sourceText: '# Plan edited\n\n## Steps\n',
    metadata: {},
    nowMs: WORLD_NOW + 5,
  });

describe('the artifact ledger', () => {
  it('lists id, kind, revision, status, producer and a hash of the live body', async () => {
    const created = await world();
    const entries = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      artifactId: expect.stringMatching(/^plan-/),
      kind: 'plan',
      revision: 1,
      status: 'active',
      producerAgentId: 'agent-planner',
      producerRole: 'planner',
      approval: 'needs_approval',
      lastAuthor: 'agent',
      contentHash: sha256Hex('# Plan\n\n- step one\n- step two\n'),
      outline: 'Plan',
    });
  });

  it('turns an approval into needs_approval when a hand edit makes a newer revision, with no tree event', async () => {
    const created = await world();
    await approveArtifact({ db: created.db, artifactId: plan1, expectedRevision: 1 });
    const before = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    expect(before.find((entry) => entry.artifactId === 'plan-1')?.approval).toBe('approved');
    await handEdit({ world: created, id: plan1, revision: 1 });
    const after = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    const edited = after.find((entry) => entry.artifactId === 'plan-1');
    expect(edited).toMatchObject({
      revision: 2,
      approval: 'needs_approval',
      lastAuthor: 'user',
      lastAsk: 'tighten step one',
    });
    expect(edited?.outline).toBe('Plan edited / Steps');
  });

  it('shows a revise as open on its artifact only, and who took a plan as input', async () => {
    const created = await world();
    await approveArtifact({ db: created.db, artifactId: plan2, expectedRevision: 1 });
    await created.scheduler.admit(
      batchInput({
        requestId: 'request-1',
        children: [
          childInput({
            key: 'rev',
            role: 'planner',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 1 },
          }),
          childInput({
            key: 'impl',
            role: 'implementer',
            inputArtifacts: [planRef({ id: 'plan-2', revision: 1 })],
          }),
        ],
      }),
    );
    const entries = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    const first = entries.find((entry) => entry.artifactId === 'plan-1');
    const second = entries.find((entry) => entry.artifactId === 'plan-2');
    expect(first).toMatchObject({
      approval: 'revising',
      openReviseDelegationId: 'delegation-rev',
      consumerDelegationIds: [],
    });
    expect(second).toMatchObject({
      approval: 'approved',
      status: 'consumed',
      consumerDelegationIds: ['delegation-impl'],
    });
  });

  it('writes a block that is byte identical when read again', async () => {
    const created = await world();
    const first = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    const second = await treeArtifacts({ db: created.db, treeId: WORLD_TREE });
    const block = buildArtifactLedgerBlock({ entries: first, nowMs: WORLD_NOW, generation: 1 });
    expect(buildArtifactLedgerBlock({ entries: second, nowMs: WORLD_NOW, generation: 1 })).toBe(
      block,
    );
    expect(block).toContain('plan-1 (plan)');
    expect(block).toContain('plan-2 (plan)');
  });
});
