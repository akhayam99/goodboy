// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EMPTY_DURATION_HISTORY } from '@goodboy/core';
import type { Agent, AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { aPlan } from '../../../../test/planFixtures';
import { SubagentTree } from './SubagentTree';
import {
  SESSION_ID,
  WORKSPACE_ID,
  baseAgents,
  scouts,
  session,
  workflow,
} from './testing/runTreeFixtures';

const ROUTING = {
  stepById: new Map(),
  roleModels: null,
  sessionProvider: null,
  sessionEffort: null,
};

const ROOT = 'implement' as AgentId;

const seed = ({ agents }: { readonly agents: ReadonlyArray<Agent> }) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [aPlan({ sessionId: SESSION_ID, agentId: ROOT })] },
    sessionTurnSpans: { [SESSION_ID]: [] },
    workspaceDurationHistory: { [WORKSPACE_ID]: EMPTY_DURATION_HISTORY },
  });
};

const renderTree = ({ children }: { readonly children: ReadonlyArray<Agent> }) =>
  render(
    <SubagentTree
      session={session}
      rootAgentId={ROOT}
      childIds={new Set(children.map((agent) => agent.id))}
      routing={ROUTING}
      onSelect={vi.fn()}
      onAnswer={vi.fn()}
    />,
  );

const rowIds = (): ReadonlyArray<string> =>
  screen
    .getAllByTestId(/^run-tree-row-/u)
    .map((row) => row.dataset.testid?.replace('run-tree-row-', '') ?? '');

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
  });
});

afterEach(cleanup);

describe('SubagentTree', () => {
  it('lists the agent and its sub-agents in order, settled ones included', () => {
    seed({ agents: [...baseAgents, ...scouts()] });
    renderTree({ children: scouts() });

    expect(screen.getByLabelText('Subagents')).toBeDefined();
    expect(rowIds()).toEqual(['implement', 'scout-a', 'scout-b', 'scout-c']);
  });

  it('never folds a set and never offers a plan button', () => {
    seed({ agents: [...baseAgents, ...scouts()] });
    renderTree({ children: scouts() });

    expect(screen.queryByTestId('run-tree-fold-row')).toBeNull();
    expect(screen.queryByRole('button', { name: /plan$/u })).toBeNull();
  });
});
