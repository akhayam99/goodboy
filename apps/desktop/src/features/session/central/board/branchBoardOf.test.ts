// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, MountId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { BranchFacts } from '../branches/branchFactsOf';
import type { BoardAgent, BoardAsk, BoardLead } from './boardTypes';
import { branchBoardOf, MERGED_FOLD_LIMIT } from './branchBoardOf';
import { sessionKpisOf } from './sessionKpisOf';

const DATE = brandId<IsoDateTime>({ value: '2026-08-04T00:00:00.000Z' });

const session: Session = {
  id: brandId<SessionId>({ value: 'session-1' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
  goal: 'Ship the ledger export',
  state: { kind: 'idle', lastActivityAt: DATE },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE,
  updatedAt: DATE,
};

type BranchOptions = {
  readonly state?: 'open' | 'merged';
  readonly checks?: 'success' | 'failure' | 'pending' | null;
  readonly hasRequest?: boolean;
  readonly mountPath?: string | null;
};

const branchOf = (id: string, options: BranchOptions = {}): BranchFacts => {
  const {
    state = 'open',
    checks = 'success',
    hasRequest = true,
    mountPath = `/wt/${id}`,
  } = options;
  return {
    mountId: brandId<MountId>({ value: id }),
    mountPath,
    projectName: 'ledger-core',
    branch: `feat/${id}`,
    baseBranch: 'main',
    request: hasRequest
      ? {
          noun: '#',
          number: 10,
          isDraft: false,
          state,
          checksWord: null,
          checks,
          reviewDecision: null,
          isMergeable: true,
          isChecksAbsent: false,
          isReviewOptional: false,
        }
      : null,
    behind: null,
    isStale: false,
    checkedAgo: null,
    liveCount: 0,
    liveTitle: null,
    isFinished: state === 'merged',
    status: null,
    series: null,
  };
};

const askOf = (id: string, mountId: string | null, leadId: string | null = 'lead-1'): BoardAsk => ({
  id,
  mountId,
  leadId,
});

const agentOf = (
  id: string,
  mountId: string | null,
  spendUsd = 1,
  leadId = 'lead-1',
): BoardAgent => ({
  id,
  leadId,
  mountId,
  spendUsd,
  elapsedMs: 1000,
  isRunning: false,
  isBlocked: false,
  isFailed: false,
});

const leadOf = (id: string, primaryMountId: string | null, spendUsd = 2): BoardLead => ({
  id,
  primaryMountId,
  spendUsd,
  elapsedMs: 500,
});

type Inputs = {
  readonly branches?: ReadonlyArray<BranchFacts>;
  readonly asks?: ReadonlyArray<BoardAsk>;
  readonly agents?: ReadonlyArray<BoardAgent>;
  readonly leads?: ReadonlyArray<BoardLead>;
  readonly recencyByMountId?: ReadonlyMap<string, number>;
};

const boardOf = ({ branches = [], asks = [], agents = [], leads = [], recencyByMountId }: Inputs) =>
  branchBoardOf({ session, branches, asks, agents, leads, recencyByMountId });

describe('branchBoardOf', () => {
  it('keeps a merged branch as a row', () => {
    const board = boardOf({ branches: [branchOf('a'), branchOf('b', { state: 'merged' })] });
    const merged = board.rows.find((row) => row.id === 'b');
    expect(merged?.group).toBe('merged');
    expect(merged?.isMerged).toBe(true);
    expect(board.rows).toHaveLength(2);
  });

  it('leaves the stage of branch B alone when branch A has a question', () => {
    const board = boardOf({
      branches: [branchOf('a'), branchOf('b')],
      asks: [askOf('q1', 'a')],
    });
    const a = board.rows.find((row) => row.id === 'a');
    const b = board.rows.find((row) => row.id === 'b');
    expect(a?.stage.stage).toBe('attention');
    expect(a?.group).toBe('needs-you');
    expect(b?.stage.stage).not.toBe('attention');
    expect(b?.group).toBe('in-progress');
  });

  it('gives a Lead on two branches two rows and one count', () => {
    const board = boardOf({
      branches: [branchOf('a'), branchOf('b')],
      agents: [agentOf('g1', 'a'), agentOf('g2', 'b')],
      leads: [leadOf('lead-1', 'a')],
    });
    expect(board.rows.filter((row) => row.leadIds.includes('lead-1'))).toHaveLength(2);
    expect(sessionKpisOf({ board }).leadCount).toBe(1);
  });

  it('counts one ask once', () => {
    const board = boardOf({
      branches: [branchOf('a'), branchOf('b')],
      asks: [askOf('q1', 'a'), askOf('q1', 'a')],
      leads: [leadOf('lead-1', 'a')],
    });
    expect(sessionKpisOf({ board }).needsYou.askCount).toBe(1);
  });

  it('keeps the row of a removed worktree by its stored id', () => {
    const board = boardOf({ branches: [branchOf('a', { mountPath: null })] });
    expect(board.rows.map((row) => row.id)).toEqual(['a']);
  });

  it('folds merged to the 3 newest while other groups have rows', () => {
    const merged = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => branchOf(id, { state: 'merged' }));
    const board = boardOf({
      branches: [branchOf('a'), ...merged],
      recencyByMountId: new Map([
        ['m1', 1],
        ['m2', 5],
        ['m3', 3],
        ['m4', 4],
        ['m5', 2],
      ]),
    });
    const group = board.groups.find((candidate) => candidate.id === 'merged');
    expect(MERGED_FOLD_LIMIT).toBe(3);
    expect(group?.visibleRowIds).toEqual(['m2', 'm4', 'm3']);
    expect(group?.hiddenCount).toBe(2);
  });

  it('shows every merged row when merged is the only group', () => {
    const merged = ['m1', 'm2', 'm3', 'm4'].map((id) => branchOf(id, { state: 'merged' }));
    const board = boardOf({ branches: merged });
    const group = board.groups.find((candidate) => candidate.id === 'merged');
    expect(group?.visibleRowIds).toHaveLength(4);
    expect(group?.hiddenCount).toBe(0);
  });

  it('draws no groups for one branch', () => {
    const board = boardOf({ branches: [branchOf('a')] });
    expect(board.isAlone).toBe(true);
    expect(board.isGrouped).toBe(false);
  });

  it('draws one group when there is no branch', () => {
    const board = boardOf({ asks: [askOf('q1', null)] });
    expect(board.groups.map((group) => group.id)).toEqual(['not-on-branch']);
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0]?.stage.stage).toBe('attention');
  });

  it('draws one empty row when there is nothing at all', () => {
    const board = boardOf({});
    expect(board.groups.map((group) => group.id)).toEqual(['not-on-branch']);
  });

  it('does not draw an empty group', () => {
    const board = boardOf({ branches: [branchOf('a'), branchOf('b')] });
    expect(board.groups.map((group) => group.id)).toEqual(['in-progress']);
  });

  it('sends work on an unknown mount to the group without a branch', () => {
    const board = boardOf({
      branches: [branchOf('a')],
      asks: [askOf('q1', 'gone')],
    });
    expect(board.rows.map((row) => row.id)).toEqual(['a', 'no-branch']);
    expect(board.groups.map((group) => group.id)).toEqual(['in-progress', 'not-on-branch']);
  });
});

describe('sessionKpisOf', () => {
  const fixtures: ReadonlyArray<Readonly<{ name: string; inputs: Inputs }>> = [
    { name: 'empty', inputs: {} },
    {
      name: 'mixed',
      inputs: {
        branches: [
          branchOf('a', { checks: 'failure' }),
          branchOf('b', { checks: 'pending' }),
          branchOf('c', { state: 'merged' }),
          branchOf('d', { hasRequest: false }),
        ],
        asks: [askOf('q1', 'a'), askOf('q2', 'a'), askOf('q3', null)],
        agents: [agentOf('g1', 'a', 1.5), agentOf('g2', 'b', 2.25), agentOf('g3', 'gone', 0.5)],
        leads: [leadOf('lead-1', 'a', 3), leadOf('lead-2', null, 1)],
      },
    },
    {
      name: 'all merged',
      inputs: {
        branches: [branchOf('a', { state: 'merged' }), branchOf('b', { state: 'merged' })],
        agents: [agentOf('g1', 'a', 4)],
        leads: [leadOf('lead-1', 'b', 1)],
      },
    },
  ];

  it.each(fixtures)('rows sum to each tile for $name', ({ inputs }) => {
    const board = boardOf(inputs);
    const kpis = sessionKpisOf({ board });
    const sourceSpend =
      (inputs.agents ?? []).reduce((sum, agent) => sum + agent.spendUsd, 0) +
      (inputs.leads ?? []).reduce((sum, lead) => sum + lead.spendUsd, 0);
    const sourceElapsed =
      (inputs.agents ?? []).reduce((sum, agent) => sum + agent.elapsedMs, 0) +
      (inputs.leads ?? []).reduce((sum, lead) => sum + lead.elapsedMs, 0);
    expect(kpis.spendUsd).toBeCloseTo(sourceSpend);
    expect(kpis.elapsedMs).toBe(sourceElapsed);
    expect(kpis.agentCount).toBe((inputs.agents ?? []).length);
    expect(kpis.needsYou.askCount).toBe(new Set((inputs.asks ?? []).map((ask) => ask.id)).size);
    expect(kpis.branches.total).toBe((inputs.branches ?? []).length);
    expect(kpis.branches.merged).toBe(
      (inputs.branches ?? []).filter((branch) => branch.isFinished).length,
    );
    expect(kpis.checks.passing + kpis.checks.failing + kpis.checks.running).toBe(kpis.checks.total);
    expect(board.rows.reduce((sum, row) => sum + row.spendUsd, 0)).toBeCloseTo(kpis.spendUsd);
  });

  it('puts the Lead turns on its primary branch and each agent on its own', () => {
    const board = boardOf({
      branches: [branchOf('a'), branchOf('b')],
      agents: [agentOf('g1', 'b', 1)],
      leads: [leadOf('lead-1', 'a', 3)],
    });
    expect(board.rows.find((row) => row.id === 'a')?.spendUsd).toBe(3);
    expect(board.rows.find((row) => row.id === 'b')?.spendUsd).toBe(1);
  });

  it('counts a merged branch in the Branches tile but not in Checks', () => {
    const board = boardOf({ branches: [branchOf('a'), branchOf('b', { state: 'merged' })] });
    const kpis = sessionKpisOf({ board });
    expect(kpis.branches).toEqual({ merged: 1, total: 2 });
    expect(kpis.checks.total).toBe(1);
  });
});
