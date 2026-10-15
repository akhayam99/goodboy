import { describe, expect, it } from 'vitest';
import {
  artifactOutline,
  buildArtifactLedgerBlock,
  effectiveApproval,
  type AutoLedgerEntry,
} from './ledger';

const NOW = 1_700_000_000_000;

const entry = (patch: Partial<AutoLedgerEntry> = {}): AutoLedgerEntry => ({
  artifactId: 'plan-1',
  kind: 'plan',
  title: 'Plan for notify-relay',
  revision: 2,
  status: 'active',
  producerAgentId: 'agent-planner',
  producerDelegationId: 'delegation-1',
  producerRole: 'planner',
  lastAuthor: 'agent',
  lastAsk: 'make step two\nsmaller',
  approval: 'needs_approval',
  openReviseDelegationId: null,
  consumerDelegationIds: [],
  contentHash: 'abcdef0123456789',
  updatedAt: NOW,
  outline: '# Plan / ## Steps',
  ...patch,
});

describe('effectiveApproval', () => {
  it('is approved only while the approved revision is the live one', () => {
    const base = {
      approvalState: 'approved',
      approvedRevision: 2,
      revision: 2,
      openReviseDelegationId: null,
    } as const;
    expect(effectiveApproval(base)).toBe('approved');
    expect(effectiveApproval({ ...base, revision: 3 })).toBe('needs_approval');
  });

  it('is revising while a revise is open, whatever was approved', () => {
    expect(
      effectiveApproval({
        approvalState: 'approved',
        approvedRevision: 2,
        revision: 2,
        openReviseDelegationId: 'delegation-5',
      }),
    ).toBe('revising');
  });
});

describe('artifactOutline', () => {
  it('keeps the headings, clipped', () => {
    expect(artifactOutline({ sourceText: '# Plan\ntext\n## Steps\n- a\n### Risks' })).toBe(
      'Plan / Steps / Risks',
    );
    expect(artifactOutline({ sourceText: `# ${'x'.repeat(900)}` })).toHaveLength(400);
  });
});

describe('buildArtifactLedgerBlock', () => {
  it('says there are none yet', () => {
    expect(buildArtifactLedgerBlock({ entries: [], nowMs: NOW, generation: 1 })).toContain(
      'None yet.',
    );
  });

  it('is byte identical for the same rows and names id, kind, revision, status and producer', () => {
    const entries = [
      entry(),
      entry({ artifactId: 'report-1', kind: 'report', title: 'Scout report', revision: 1 }),
    ];
    const first = buildArtifactLedgerBlock({ entries, nowMs: NOW, generation: 3 });
    const second = buildArtifactLedgerBlock({ entries, nowMs: NOW, generation: 3 });
    expect(second).toBe(first);
    expect(first).toContain('generation 3');
    expect(first).toContain(
      '- plan-1 (plan) "Plan for notify-relay" v2, active, approval needs_approval',
    );
    expect(first).toContain(
      'made by planner agent-planner in delegation-1; last edit by agent: make step two smaller',
    );
    expect(first).toContain('Never create a second artifact to change one.');
  });

  it('stays inside the character budget and counts what it hides', () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      entry({
        artifactId: `plan-${index}`,
        title: `Plan number ${index}`,
        outline: 'x'.repeat(300),
      }),
    );
    const block = buildArtifactLedgerBlock({ entries: many, nowMs: NOW, generation: 1 });
    expect(block.length).toBeLessThan(3_300);
    expect(block).toMatch(/\d+ more not shown/);
  });
});
