import { describe, expect, it } from 'vitest';
import type { AutoArtifactLedgerRow } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import { markLabelOf, markersOf } from './markersOf';

type RowParams = {
  readonly id: string;
  readonly owner: string;
  readonly kind: 'plan' | 'report' | 'wireframe';
  readonly revision: number;
  readonly approved?: number | null;
  readonly createdAt?: number;
};

const row = ({
  id,
  owner,
  kind,
  revision,
  approved = null,
  createdAt = 0,
}: RowParams): AutoArtifactLedgerRow => ({
  artifact: {
    artifactId: brandId<ArtifactId>({ value: id }),
    treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
    kind,
    ownerAgentId: brandId<AgentId>({ value: owner }),
    ownerDelegationId: brandId<AutoDelegationId>({ value: 'd-1' }),
    ownerRole: kind,
    approvalState: approved === null ? 'needs_approval' : 'approved',
    approvedRevision: approved,
    openReviseDelegationId: null,
    rev: 1,
    createdAt,
  },
  title: 'Idempotent webhooks in payments-api',
  revision,
  status: 'active',
  sourceText: '',
  updatedAt: createdAt,
  lastAuthor: null,
  lastAsk: null,
});

describe('markersOf', () => {
  it('groups permissions per agent with a count and the tool names once', () => {
    const marks = markersOf({
      permissions: [
        { agentId: 'a', toolName: 'Grep', decision: 'allow' },
        { agentId: 'a', toolName: 'Bash', decision: 'allow' },
        { agentId: 'a', toolName: 'Grep', decision: 'allow' },
        { agentId: 'a', toolName: 'Read', decision: 'deny' },
        { agentId: 'b', toolName: 'Grep', decision: 'deny' },
      ],
      artifacts: [],
    });
    expect(marks.get('a')?.permissions).toEqual([
      { decision: 'allow', count: 3, tools: ['Grep', 'Bash'] },
      { decision: 'deny', count: 1, tools: ['Read'] },
    ]);
    expect(marks.get('b')?.permissions).toEqual([{ decision: 'deny', count: 1, tools: ['Grep'] }]);
  });

  it('puts a plan with its approved version and a report with its version on the owner', () => {
    const marks = markersOf({
      permissions: [],
      artifacts: [
        row({ id: 'p', owner: 'planner', kind: 'plan', revision: 7, approved: 7 }),
        row({ id: 'r', owner: 'reviewer', kind: 'report', revision: 2 }),
      ],
    });
    expect(marks.get('planner')?.labelled.map((mark) => mark.label)).toEqual(['Plan v7 approved']);
    expect(marks.get('reviewer')?.labelled).toEqual([
      { id: 'mark:r', artifactId: 'r', label: 'Report v2' },
    ]);
  });

  it('does not say approved for a plan that waits or is being revised', () => {
    expect(markLabelOf({ row: row({ id: 'p', owner: 'a', kind: 'plan', revision: 3 }) })).toBe(
      'Plan v3',
    );
  });

  it('gives an agent with nothing no entry', () => {
    expect(markersOf({ permissions: [], artifacts: [] }).size).toBe(0);
  });
});
