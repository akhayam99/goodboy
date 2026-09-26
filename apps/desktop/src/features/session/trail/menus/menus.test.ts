import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  StepId,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import type { CrumbMenuModel } from '@goodboy/ui';
import { lensDestinations } from '../../lens-destinations';
import type { AgentStateWord } from '../../agentStateWord';
import { pageMenu } from './pageMenu';
import { stepMenu } from './stepMenu';
import { runMenu } from './runMenu';
import { agentMenu } from './agentMenu';
import { artifactMenu } from './artifactMenu';

const rowsOf = (menu: CrumbMenuModel) => menu.groups.flatMap((group) => group.rows);
const labelsOf = (menu: CrumbMenuModel) => rowsOf(menu).map((row) => row.label);

const agent = (overrides: Partial<Agent> & Pick<Agent, 'id' | 'name'>): Agent =>
  ({ sessionId: 'session-1', ordinal: 0, status: 'completed', ...overrides }) as Agent;

const RUN_ID = 'run-1' as WorkflowRunId;

const workflow = {
  id: 'workflow-1',
  name: 'Fix a bug',
  steps: [
    { id: 'step-1' as StepId, name: 'Scout the webhook module', ordinal: 0, role: 'scout' },
    { id: 'step-2' as StepId, name: 'Implement the fix', ordinal: 1, role: 'implementer' },
    { id: 'step-3' as StepId, name: 'Test the retry path', ordinal: 2, role: 'tester' },
  ],
} as unknown as Workflow;

const stateOf = (candidate: Agent): AgentStateWord =>
  candidate.status === 'running'
    ? { word: 'Running', tone: 'info', group: 'running' }
    : { word: 'Done', tone: 'success', group: 'done' };

const everyMenuInvariant = (menu: CrumbMenuModel) => {
  const rows = rowsOf(menu);
  expect(rows.every((row) => row.lead != null)).toBe(true);
  expect(rows.every((row) => row.state === null || row.state.word !== '')).toBe(true);
  expect(menu.actions.length).toBeLessThanOrEqual(2);
};

describe('pageMenu', () => {
  it('lists the pages that exist, marks the one open, and names Tools and Linked', () => {
    const onSelect = vi.fn();
    const menu = pageMenu({
      destinations: lensDestinations({
        isBranchless: false,
        isGithubCodeHost: false,
        connectedTools: { linear: true, gitlab: false, jira: false, slack: false },
      }),
      activeLens: 'agents',
      isBranchless: false,
      sessionTitle: 'Retry failed webhook deliveries',
      summaries: { agents: '2 running', review: '3 need you' },
      actions: [],
      onSelect,
    });

    everyMenuInvariant(menu);
    expect(menu.groups.map((group) => group.label)).toEqual([null, 'Tools', 'Linked']);
    expect(labelsOf(menu)).toContain('Pull request');
    expect(labelsOf(menu)).not.toContain('Code host');
    const agents = rowsOf(menu).find((row) => row.label === 'Agents');
    expect(agents?.isCurrent).toBe(true);
    expect(agents?.metaA).toBe('2 running');
    expect(rowsOf(menu).filter((row) => row.isCurrent)).toHaveLength(1);
    rowsOf(menu)
      .find((row) => row.label === 'Overview')
      ?.onSelect();
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('stepMenu', () => {
  it('lists every step in order, the ones not started switched off', () => {
    const scout = agent({
      id: 'a1' as AgentId,
      name: 'Scout',
      stepId: 'step-1' as StepId,
      workflowRunId: RUN_ID,
    });
    const impl = agent({
      id: 'a2' as AgentId,
      name: 'Implement',
      stepId: 'step-2' as StepId,
      workflowRunId: RUN_ID,
      status: 'running',
    });
    const menu = stepMenu({
      workflow,
      runId: RUN_ID,
      runTitle: 'Ship a fix',
      agents: [scout, impl],
      currentAgentId: impl.id,
      stateOf,
      roleLabelOf: (_, role) => role,
      modelOf: (stepAgent) => stepAgent?.modelOverride ?? 'Auto',
      actions: [],
      onSelect: vi.fn(),
    });

    everyMenuInvariant(menu);
    expect(labelsOf(menu)).toEqual([
      'Scout the webhook module',
      'Implement the fix',
      'Test the retry path',
    ]);
    const rows = rowsOf(menu);
    expect(rows[2]?.isDisabled).toBe(true);
    expect(rows[2]?.state?.word).toBe('Not started');
    expect(rows[1]?.isCurrent).toBe(true);
    expect(menu.count).toBe('2 of 3');
  });
});

describe('runMenu', () => {
  it('splits running and finished runs and hangs a chained run under its own', () => {
    const ship = {
      id: 'run-1',
      title: 'Ship a fix',
      workflowId: 'workflow-1',
    } as unknown as WorkflowRun;
    const notes = {
      id: 'run-2',
      title: 'Write release notes',
      workflowId: 'workflow-1',
      chainAfterId: 'run-1',
    } as unknown as WorkflowRun;
    const drift = { id: 'run-3', title: null, workflowId: 'workflow-1' } as unknown as WorkflowRun;
    const menu = runMenu({
      runs: [
        { run: ship, workflow, isFinished: false },
        { run: notes, workflow, isFinished: false },
        { run: drift, workflow, isFinished: true },
      ],
      agents: [],
      currentRunId: RUN_ID,
      nameOf: (entry) => entry.run.title ?? entry.workflow.name,
      actions: [],
      onSelect: vi.fn(),
    });

    everyMenuInvariant(menu);
    expect(menu.groups.map((group) => group.label)).toEqual(['Running', 'Finished']);
    const notesRow = rowsOf(menu).find((row) => row.label === 'Write release notes');
    expect(notesRow?.indent).toBe(1);
    expect(notesRow?.secondary).toBe('after Ship a fix');
    expect(rowsOf(menu).find((row) => row.label === 'Fix a bug')?.state?.word).toBe('Done');
    expect(rowsOf(menu)[0]?.metaA).toBe('0 of 3');
  });
});

describe('agentMenu', () => {
  it('groups by state, most recent first, and keeps the current row even alone', () => {
    const older = agent({ id: 'a1' as AgentId, name: 'Map the settlement tables', ordinal: 1 });
    const newer = agent({ id: 'a2' as AgentId, name: 'Explain the 409', ordinal: 2 });
    const live = agent({
      id: 'a3' as AgentId,
      name: 'Update the typed orders client',
      ordinal: 0,
      status: 'running',
    });
    const menu = agentMenu({
      peers: [older, newer, live],
      currentAgentId: newer.id,
      stateOf,
      roleOf: () => ({ label: 'Scout', tone: 'text-agent-scout' }),
      modelOf: () => 'Haiku 4.5',
      actions: [],
      onSelect: vi.fn(),
    });

    everyMenuInvariant(menu);
    expect(menu.groups.map((group) => group.label)).toEqual(['Running', 'Done']);
    expect(menu.groups[1]?.rows.map((row) => row.label)).toEqual([
      'Explain the 409',
      'Map the settlement tables',
    ]);

    const lonely = agentMenu({
      peers: [newer],
      currentAgentId: newer.id,
      stateOf,
      roleOf: () => ({ label: 'Scout', tone: 'text-agent-scout' }),
      modelOf: () => null,
      actions: [],
      onSelect: vi.fn(),
    });
    expect(rowsOf(lonely)).toHaveLength(1);
    expect(rowsOf(lonely)[0]?.isCurrent).toBe(true);
  });
});

describe('artifactMenu', () => {
  it('groups artifacts by kind in page order with revision and age', () => {
    const menu = artifactMenu({
      artifacts: [
        {
          id: 'r1' as ArtifactId,
          kind: 'report',
          title: 'Settlement drift report',
          revision: 1,
          updatedAt: 't',
          author: 'Scout',
        },
        {
          id: 'w1' as ArtifactId,
          kind: 'wireframe',
          title: 'Checkout error states',
          revision: 3,
          updatedAt: 't',
          author: 'Planner',
        },
      ],
      currentId: 'w1' as ArtifactId,
      ageOf: () => '20m ago',
      onSelect: vi.fn(),
    });

    everyMenuInvariant(menu);
    expect(menu.groups.map((group) => group.label)).toEqual(['Wireframes', 'Reports']);
    expect(rowsOf(menu)[0]?.metaA).toBe('v3 · 20m ago');
    expect(rowsOf(menu)[0]?.isCurrent).toBe(true);
  });
});
