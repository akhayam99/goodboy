import { describe, expect, it } from 'vitest';
import { nextAgentId } from '@goodboy/types/testing';
import { leadTreeItemsOf, type LeadTreeAgentFact } from './leadTreeItemsOf';
import type { LeadTree } from './leadTreeOf';

const AGENT_ID = nextAgentId();

const FACT: LeadTreeAgentFact = {
  agentId: AGENT_ID,
  title: 'Plan the guard on the event id',
  agentKind: 'planner',
  node: 'done',
  word: 'Done',
};

const TREE: LeadTree = {
  rows: [
    {
      kind: 'agent',
      id: 'd1',
      number: '1',
      depth: 0,
      role: 'planner',
      agentId: AGENT_ID,
      attempts: [],
      mountId: null,
      isSettled: true,
      ownSpendUsd: 0.5,
      branchSpendUsd: 0.5,
    },
    { kind: 'note', id: 'n1', depth: 1, createdAt: 5 },
  ],
  totalSpendUsd: 0.5,
  spendByBranch: [],
};

describe('leadTreeItemsOf', () => {
  it('puts the permissions on the agent and its plan marker under it, before its notes', () => {
    const items = leadTreeItemsOf({
      tree: TREE,
      agentsById: new Map([[AGENT_ID, FACT]]),
      notes: [
        {
          id: 'n1',
          createdAt: 5,
          text: 'Keep the retry window at 30 seconds',
          word: 'Read at turn 2',
          isRead: true,
          canEdit: false,
          canRemove: false,
        },
      ],
      marks: new Map([
        [
          AGENT_ID,
          {
            permissions: [{ decision: 'allow', count: 1, tools: ['Grep'] }],
            labelled: [{ id: 'mark:plan-1', artifactId: 'plan-1', label: 'Plan v7 approved' }],
          },
        ],
      ]),
    });
    expect(items.map((item) => item.kind)).toEqual(['agent', 'mark', 'note']);
    const [agent, mark] = items;
    expect(agent?.kind === 'agent' ? agent.permissions : []).toHaveLength(1);
    expect(mark).toMatchObject({ kind: 'mark', depth: 1, label: 'Plan v7 approved' });
  });

  it('gives an agent with no marks no extra row', () => {
    const items = leadTreeItemsOf({
      tree: { ...TREE, rows: TREE.rows.slice(0, 1) },
      agentsById: new Map([[AGENT_ID, FACT]]),
      notes: [],
    });
    expect(items).toHaveLength(1);
  });
});
