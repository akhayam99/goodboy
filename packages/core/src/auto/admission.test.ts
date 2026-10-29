import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { AgentId, ArtifactId, AutoDelegationId, AutoTreeId, SessionId } from '@goodboy/types';
import type { AutoArtifact, AutoTree } from '@goodboy/db';
import {
  diagnoseAdmission,
  type AdmissionArtifactFacts,
  type AdmissionChild,
  type AdmissionSnapshot,
} from './admission';
import type { AdmissionParentFacts } from './substepAdmission';

const NOW = 1_700_000_000_000;
const ROOT = brandId<AgentId>({ value: 'agent-auto-root' });

const tree = (patch: Partial<AutoTree> = {}): AutoTree => ({
  id: brandId<AutoTreeId>({ value: 'tree-1' }),
  rootAgentId: ROOT,
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  primaryMountId: 'mount-ledger-core',
  generation: 1,
  phase: 'deciding',
  phaseRev: 3,
  blockedReason: null,
  activeRunId: 'run-1',
  activeDeliveryId: null,
  isYieldRequested: false,
  stopState: 'none',
  capUsd: 5,
  turnsUsed: 1,
  delegationsUsed: 0,
  attemptsUsed: 0,
  refusalsUsed: 0,
  turnDelegateCalls: 0,
  noProgressStreak: 0,
  questionCycles: 0,
  grants: 0,
  createdAt: NOW,
  updatedAt: NOW,
  hardDeadlineAt: NOW + 86_400_000,
  schedulerOwner: 'window-a',
  ownerLeaseExpiresAt: NOW + 30_000,
  ...patch,
});

const snapshot = (patch: Partial<AdmissionSnapshot> = {}): AdmissionSnapshot => ({
  tree: tree(),
  ownerId: 'window-a',
  nowMs: NOW,
  callerAgentId: ROOT,
  expectedGeneration: 1,
  expectedRunId: 'run-1',
  openCount: 0,
  openChildAgentIds: [],
  remainingUsd: 5,
  artifacts: [],
  isPlanApprovalRequired: true,
  ...patch,
});

const scout = (agent = 'agent-scout-1'): AdmissionChild => ({
  childAgentId: agent,
  role: 'scout',
  reviseOf: null,
  inputArtifacts: [],
});

const registered = (patch: Partial<AutoArtifact> = {}): AutoArtifact => ({
  artifactId: brandId<ArtifactId>({ value: 'plan-1' }),
  treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
  kind: 'plan',
  ownerAgentId: brandId<AgentId>({ value: 'agent-planner' }),
  ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
  ownerRole: 'planner',
  approvalState: 'needs_approval',
  approvedRevision: null,
  openReviseDelegationId: null,
  rev: 0,
  createdAt: NOW,
  ...patch,
});

type FactsParams = {
  readonly artifact?: Partial<AutoArtifact>;
  readonly live?: { readonly revision: number; readonly status: string };
};

const planFacts = ({
  artifact = {},
  live = { revision: 2, status: 'active' },
}: FactsParams = {}): AdmissionArtifactFacts & { readonly artifactId: string } => ({
  artifactId: 'plan-1',
  registered: registered(artifact),
  live: { ...live, sourceText: '# Plan v2\n' },
});

const revise = (expectedRevision = 2): AdmissionChild => ({
  childAgentId: 'agent-planner',
  role: 'planner',
  reviseOf: { artifactId: 'plan-1', revision: expectedRevision },
  inputArtifacts: [],
});

const implementer = (revision = 2): AdmissionChild => ({
  childAgentId: 'agent-impl',
  role: 'implementer',
  reviseOf: null,
  inputArtifacts: [{ artifactId: 'plan-1', revision }],
});

const codeOf = (verdict: ReturnType<typeof diagnoseAdmission>): string =>
  verdict.kind === 'refused' ? verdict.code : 'ok';

describe('diagnoseAdmission', () => {
  it('accepts a batch inside every limit and holds no money for it', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshot({ remainingUsd: 4 }),
      children: [scout(), scout('agent-scout-2')],
    });
    expect(verdict).toEqual({ kind: 'ok' });
  });

  it('admits an implementer and a scout on the last cents of the limit, with no ceiling', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshot({
        remainingUsd: 0.01,
        artifacts: [planFacts({ artifact: { approvalState: 'approved', approvedRevision: 2 } })],
      }),
      children: [implementer(2), scout()],
    });
    expect(verdict).toEqual({ kind: 'ok' });
  });

  it('admits with no limit', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshot({ remainingUsd: Number.POSITIVE_INFINITY }),
      children: [scout(), scout('agent-scout-2')],
    });
    expect(verdict).toEqual({ kind: 'ok' });
  });

  it('refuses the whole batch with budget once real spend reached the limit', () => {
    for (const remainingUsd of [0, -0.4]) {
      const verdict = diagnoseAdmission({
        snapshot: snapshot({ remainingUsd }),
        children: [scout(), scout('agent-scout-2')],
      });
      expect(verdict).toEqual({ kind: 'refused', code: 'budget', perChild: [] });
    }
  });

  it('refuses a caller that is not the root of the tree as a depth cap', () => {
    expect(
      codeOf(
        diagnoseAdmission({
          snapshot: snapshot({ callerAgentId: 'agent-child' }),
          children: [scout()],
        }),
      ),
    ).toBe('depth_cap');
  });

  it('refuses a second delegate call in the same turn once the receipt yielded', () => {
    const yielded = tree({ phase: 'delegating', isYieldRequested: true });
    expect(
      codeOf(diagnoseAdmission({ snapshot: snapshot({ tree: yielded }), children: [scout()] })),
    ).toBe('already_yielded');
  });

  it('refuses outside the deciding turn, on another run, after a stop and on an old generation', () => {
    const cases: ReadonlyArray<readonly [Partial<AutoTree>, string]> = [
      [{ phase: 'waiting' }, 'not_deciding'],
      [{ activeRunId: 'run-9' }, 'not_deciding'],
      [{ stopState: 'requested' }, 'tree_stopped'],
      [{ phase: 'stopped' }, 'tree_stopped'],
      [{ generation: 2 }, 'generation_changed'],
    ];
    for (const [patch, code] of cases) {
      expect(
        codeOf(
          diagnoseAdmission({ snapshot: snapshot({ tree: tree(patch) }), children: [scout()] }),
        ),
      ).toBe(code);
    }
  });

  it('refuses a window that does not own the tree, or whose lease ran out', () => {
    expect(
      codeOf(
        diagnoseAdmission({ snapshot: snapshot({ ownerId: 'window-b' }), children: [scout()] }),
      ),
    ).toBe('not_owner');
    expect(
      codeOf(
        diagnoseAdmission({
          snapshot: snapshot({ tree: tree({ ownerLeaseExpiresAt: NOW }) }),
          children: [scout()],
        }),
      ),
    ).toBe('not_owner');
    expect(
      codeOf(diagnoseAdmission({ snapshot: snapshot({ tree: null }), children: [scout()] })),
    ).toBe('not_owner');
  });

  it('names the guard that tripped and never stops on a count of agents or runs', () => {
    const cases: ReadonlyArray<readonly [Partial<AutoTree>, string]> = [
      [{ turnDelegateCalls: 6 }, 'limit_calls'],
      [{ refusalsUsed: 10 }, 'limit_refusals'],
      [{ hardDeadlineAt: NOW }, 'limit_wall_clock'],
    ];
    for (const [patch, code] of cases) {
      expect(
        codeOf(
          diagnoseAdmission({ snapshot: snapshot({ tree: tree(patch) }), children: [scout()] }),
        ),
      ).toBe(code);
    }
    for (const used of [12, 13, 40, 500]) {
      const old = tree({ delegationsUsed: used, attemptsUsed: used + 8, grants: 3 });
      expect(
        codeOf(diagnoseAdmission({ snapshot: snapshot({ tree: old }), children: [scout()] })),
      ).toBe('ok');
    }
  });

  it('refuses at the spend cap, then admits once the limit is raised', () => {
    const empty = snapshot({ remainingUsd: 0 });
    expect(codeOf(diagnoseAdmission({ snapshot: empty, children: [scout()] }))).toBe('budget');
    const raised = snapshot({ remainingUsd: 5 });
    expect(codeOf(diagnoseAdmission({ snapshot: raised, children: [scout()] }))).toBe('ok');
  });

  it('caps the batch at four and the open children at four', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((suffix) => scout(`agent-${suffix}`));
    expect(codeOf(diagnoseAdmission({ snapshot: snapshot(), children: five }))).toBe('breadth_cap');
    expect(codeOf(diagnoseAdmission({ snapshot: snapshot(), children: [] }))).toBe('empty_batch');
    expect(
      codeOf(
        diagnoseAdmission({
          snapshot: snapshot({ openCount: 3 }),
          children: [scout(), scout('agent-s2')],
        }),
      ),
    ).toBe('breadth_cap');
  });

  describe('substeps', () => {
    const parent = (patch: Partial<AdmissionParentFacts> = {}): AdmissionParentFacts => ({
      delegationId: 'delegation-parent',
      state: 'paused',
      generation: 1,
      pausedQuestionId: 'question-1',
      depth: 1,
      substeps: 0,
      ...patch,
    });

    const helper = (agent = 'agent-scout-2', questionId = 'question-1'): AdmissionChild => ({
      ...scout(agent),
      substep: { parentDelegationId: 'delegation-parent', questionId },
    });

    const verdictOf = (
      parents: ReadonlyArray<AdmissionParentFacts>,
      children: ReadonlyArray<AdmissionChild>,
      patch: Partial<AdmissionSnapshot> = {},
    ) => diagnoseAdmission({ snapshot: snapshot({ parents, ...patch }), children });

    it('admits a scout for a parent paused on that question in this generation', () => {
      expect(codeOf(verdictOf([parent()], [helper()]))).toBe('ok');
    });

    it('admits four substeps at once when four paused parents left the open count', () => {
      const parents = [1, 2, 3, 4].map((n) =>
        parent({ delegationId: `delegation-parent-${n}`, pausedQuestionId: `question-${n}` }),
      );
      const children = [1, 2, 3, 4].map((n): AdmissionChild => ({
        ...scout(`agent-scout-${n + 10}`),
        substep: { parentDelegationId: `delegation-parent-${n}`, questionId: `question-${n}` },
      }));
      expect(codeOf(verdictOf(parents, children, { openCount: 0 }))).toBe('ok');
    });

    it('refuses a parent that is not paused, paused on another question, or unknown', () => {
      expect(codeOf(verdictOf([parent({ state: 'running' })], [helper()]))).toBe('not_paused');
      expect(codeOf(verdictOf([parent()], [helper('agent-scout-2', 'question-9')]))).toBe(
        'not_paused',
      );
      expect(codeOf(verdictOf([], [helper()]))).toBe('not_paused');
    });

    it('refuses a paused parent of an older generation as generation_changed', () => {
      expect(codeOf(verdictOf([parent({ generation: 0 })], [helper()]))).toBe('generation_changed');
    });

    it('refuses a substep of a substep as a depth cap', () => {
      expect(codeOf(verdictOf([parent({ depth: 2 })], [helper()]))).toBe('depth_cap');
    });

    it('refuses the third substep of one parent, across batches and inside one batch', () => {
      expect(codeOf(verdictOf([parent({ substeps: 2 })], [helper()]))).toBe('substep_cap');
      const trio = [helper('agent-scout-2'), helper('agent-scout-3'), helper('agent-scout-4')];
      const verdict = verdictOf([parent()], trio);
      expect(verdict).toMatchObject({
        kind: 'refused',
        code: 'substep_cap',
        perChild: [{ slot: 2 }],
      });
    });

    it('refuses a role that cannot be a substep', () => {
      const writer: AdmissionChild = {
        ...implementer(),
        substep: { parentDelegationId: 'delegation-parent', questionId: 'question-1' },
      };
      expect(codeOf(verdictOf([parent()], [writer]))).toBe('role_mismatch');
    });

    it('refuses with generation_changed when the tree moved on', () => {
      expect(codeOf(verdictOf([parent()], [helper()], { expectedGeneration: 0 }))).toBe(
        'generation_changed',
      );
    });
  });

  describe('revise', () => {
    it('accepts a revise of the producer on its latest revision', () => {
      const verdict = diagnoseAdmission({
        snapshot: snapshot({ artifacts: [planFacts()] }),
        children: [revise()],
      });
      expect(verdict.kind).toBe('ok');
    });

    it('refuses an artifact of another tree, an unknown one, and a stale base with the latest revision', () => {
      const other = planFacts({ artifact: { treeId: brandId<AutoTreeId>({ value: 'tree-2' }) } });
      expect(
        codeOf(
          diagnoseAdmission({ snapshot: snapshot({ artifacts: [other] }), children: [revise()] }),
        ),
      ).toBe('artifact_unknown');
      expect(
        codeOf(diagnoseAdmission({ snapshot: snapshot({ artifacts: [] }), children: [revise()] })),
      ).toBe('artifact_unknown');
      const stale = diagnoseAdmission({
        snapshot: snapshot({ artifacts: [planFacts()] }),
        children: [revise(1)],
      });
      expect(stale).toMatchObject({
        kind: 'refused',
        code: 'stale_revision',
        perChild: [{ slot: 0, latestRevision: 2 }],
      });
    });

    it('refuses a consumed, a discarded and a busy artifact, and the wrong role', () => {
      const consumed = planFacts({ live: { revision: 2, status: 'consumed' } });
      const discarded = planFacts({ live: { revision: 2, status: 'discarded' } });
      const busy = planFacts({
        artifact: {
          approvalState: 'revising',
          openReviseDelegationId: brandId<AutoDelegationId>({ value: 'delegation-5' }),
        },
      });
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [consumed] }),
            children: [revise()],
          }),
        ),
      ).toBe('artifact_consumed');
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [discarded] }),
            children: [revise()],
          }),
        ),
      ).toBe('artifact_discarded');
      expect(
        codeOf(
          diagnoseAdmission({ snapshot: snapshot({ artifacts: [busy] }), children: [revise()] }),
        ),
      ).toBe('artifact_busy');
      const wrongRole: AdmissionChild = { ...revise(), role: 'scout' };
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [planFacts()] }),
            children: [wrongRole],
          }),
        ),
      ).toBe('role_mismatch');
    });

    it('refuses a producer that already has an open delegation, and two revises of one artifact', () => {
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [planFacts()], openChildAgentIds: ['agent-planner'] }),
            children: [revise()],
          }),
        ),
      ).toBe('artifact_busy');
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [planFacts()] }),
            children: [revise(), revise()],
          }),
        ),
      ).toBe('artifact_busy');
    });
  });

  describe('plan as input', () => {
    it.each(['step', 'plan', 'run'] as const)(
      'applies the %s level to an unapproved plan without relaxing revision checks',
      (level) => {
        const current = snapshot({ level, artifacts: [planFacts()] });
        expect(codeOf(diagnoseAdmission({ snapshot: current, children: [implementer()] }))).toBe(
          level === 'run' ? 'ok' : 'artifact_unapproved',
        );
        expect(codeOf(diagnoseAdmission({ snapshot: current, children: [implementer(1)] }))).toBe(
          'stale_revision',
        );
        expect(codeOf(diagnoseAdmission({ snapshot: current, children: [scout()] }))).toBe('ok');
      },
    );

    it('lets a writer take a plan only at the revision that was approved', () => {
      const approved = planFacts({ artifact: { approvalState: 'approved', approvedRevision: 2 } });
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [approved] }),
            children: [implementer()],
          }),
        ),
      ).toBe('ok');
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [planFacts()] }),
            children: [implementer()],
          }),
        ),
      ).toBe('artifact_unapproved');
      const approvedOld = planFacts({
        artifact: { approvalState: 'approved', approvedRevision: 1 },
      });
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [approvedOld] }),
            children: [implementer()],
          }),
        ),
      ).toBe('artifact_unapproved');
    });

    it('skips the approval check when the user turned the confirm card off, but keeps the revision', () => {
      const relaxed = snapshot({ artifacts: [planFacts()], isPlanApprovalRequired: false });
      expect(codeOf(diagnoseAdmission({ snapshot: relaxed, children: [implementer()] }))).toBe(
        'ok',
      );
      expect(codeOf(diagnoseAdmission({ snapshot: relaxed, children: [implementer(1)] }))).toBe(
        'stale_revision',
      );
    });

    it('refuses a plan that is being revised', () => {
      const revising = planFacts({
        artifact: {
          approvalState: 'revising',
          openReviseDelegationId: brandId<AutoDelegationId>({ value: 'delegation-5' }),
        },
      });
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [revising] }),
            children: [implementer()],
          }),
        ),
      ).toBe('artifact_revising');
    });

    it('never needs approval for a read only role', () => {
      const reviewer: AdmissionChild = {
        childAgentId: 'agent-reviewer',
        role: 'reviewer',
        reviseOf: null,
        inputArtifacts: [{ artifactId: 'plan-1', revision: 2 }],
      };
      expect(
        codeOf(
          diagnoseAdmission({
            snapshot: snapshot({ artifacts: [planFacts()] }),
            children: [reviewer],
          }),
        ),
      ).toBe('ok');
    });
  });
});
