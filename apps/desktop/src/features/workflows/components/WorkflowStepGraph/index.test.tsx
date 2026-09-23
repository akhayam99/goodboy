// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  CapabilityObligation,
  ClusterCompletionHold,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { brandColor } from '../../../providers/components/provider-brand';
import { useAppStore } from '../../../../store';
import { WorkflowStepGraph } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Ship',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
      modelOverride: 'claude-sonnet-4-5',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
      modelOverride: 'gpt-5.1-codex',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agent = (patch: Partial<Agent> & Pick<Agent, 'id' | 'ordinal' | 'name'>): Agent => ({
  sessionId: SESSION_ID,
  status: 'pending',
  ...patch,
});

const scout = agent({
  id: 'agent-1' as AgentId,
  stepId: 'step-1' as StepId,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
});
const implement = agent({
  id: 'agent-2' as AgentId,
  stepId: 'step-2' as StepId,
  ordinal: 1,
  name: 'Implement',
  status: 'running',
});

const subScout = (index: number, status: Agent['status']): Agent =>
  agent({
    id: `child-${index}` as AgentId,
    parentAgentId: scout.id,
    ordinal: index,
    name: `Scout area ${index}`,
    status,
  });

const renderGraph = (
  children: ReadonlyMap<string, ReadonlyArray<Agent>>,
  onSelect = vi.fn(),
  agentProviderOverride: Record<string, 'cursor'> = {},
) => {
  render(
    <WorkflowStepGraph
      workflow={workflow}
      runs={[scout, implement]}
      childrenByParentId={children}
      agentKindOverride={{}}
      agentModelOverride={{}}
      agentProviderOverride={agentProviderOverride}
      roleModels={null}
      sessionProvider={null}
      sessionEffort={null}
      selectedAgentId={null}
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

const railSvgOf = (id: string): Element => {
  const svg = screen.getByTestId(`workflow-step-rail-${id}`).firstElementChild;
  if (svg === null) {
    throw new Error(`no rail drawn for ${id}`);
  }
  return svg;
};

const railColumnOf = (id: string): string | null =>
  screen
    .getByTestId(`workflow-step-rail-${id}`)
    .querySelector('[data-rail-column]')
    ?.getAttribute('data-rail-column') ?? null;

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    clusterCompletionHolds: {},
    capabilityObligations: {},
  });
});

describe('WorkflowStepGraph', () => {
  it('numbers the steps down the spine and shows a fan-out without asking', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Scout area 1')).toBeDefined();
    expect(screen.getByText('1.1')).toBeDefined();
    expect(screen.getByText('1.2')).toBeDefined();
  });

  it('keeps the numbering for screen readers once the rail replaces it', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed')]]]));

    for (const marker of ['1', '2', '1.1']) {
      const label = screen.getByText(marker);
      expect(label.className).toContain('sr-only');
      expect(label.closest('button')).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: /^1 /u })).toBeDefined();
  });

  it('gives every depth its own rail column and branches the cluster off its parent', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(railColumnOf(scout.id)).toBe('0');
    expect(railColumnOf('child-1')).toBe('1');
    expect(railColumnOf('child-2')).toBe('1');
    expect(railColumnOf(implement.id)).toBe('0');
    expect(railSvgOf(scout.id).querySelectorAll('path')).toHaveLength(1);
    expect(railSvgOf(implement.id).querySelectorAll('path')).toHaveLength(0);
  });

  it('runs the rail solid once every step has started', () => {
    renderGraph(new Map());

    const started = [...railSvgOf(scout.id).querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );
    const ahead = [...railSvgOf(implement.id).querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );

    expect(started).toEqual([null]);
    expect(ahead).toEqual([null]);
  });

  it('dashes the rail into a step nobody has started yet', () => {
    renderGraph(new Map([[implement.id, [subScout(1, 'pending')]]]));

    const dashes = [...railSvgOf('child-1').querySelectorAll('line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );

    expect(dashes).toContain('3 3');
  });

  it('marks the rail done, running, and not started the way the activity timeline does', () => {
    renderGraph(new Map([[implement.id, [subScout(1, 'pending')]]]));

    expect(screen.getByLabelText('Done')).toBeDefined();
    expect(screen.getByLabelText('Running')).toBeDefined();
    expect(document.querySelectorAll('[class*="animate-soft-pulse"]').length).toBeGreaterThan(0);
    const pending = screen.getByLabelText('Not started');
    expect(pending.parentElement?.className).toContain('border-dashed');
  });

  it('counts the children without offering a way to fold them away', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed'), subScout(2, 'running')]]]));

    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.queryByRole('button', { name: /agents under Scout/i })).toBeNull();
  });

  it('keeps showing the status of a node that has children', () => {
    renderGraph(new Map([[scout.id, [subScout(1, 'completed')]]]));

    expect(screen.getByLabelText('Scout status: completed')).toBeDefined();
    expect(screen.getByLabelText('Implement status: running')).toBeDefined();
  });

  it('opens the chat of the step that was clicked', () => {
    const onSelect = renderGraph(new Map());

    fireEvent.click(screen.getByRole('button', { name: /Implement/ }));

    expect(onSelect).toHaveBeenCalledWith(implement.id);
  });

  it('keeps the planned routing for a step that has not run yet', () => {
    renderGraph(new Map());

    expect(screen.getByTitle('Model: claude-sonnet-4-5')).toBeDefined();
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('shows the model that actually ran and names the plan it replaced', () => {
    useAppStore.setState({
      agentRunHistory: { [scout.id]: ['run-1' as ProviderRunId] },
      sessionTelemetry: {
        [SESSION_ID]: [
          {
            id: 'rec-1',
            runId: 'run-1' as ProviderRunId,
            sessionId: SESSION_ID,
            kind: 'turn',
            provider: 'gemini',
            model: 'gemini-3-pro',
            inputTokens: 10,
            outputTokens: 2,
            estimatedCostUsd: 0.1,
            recordedAt: NOW,
          } as TelemetryRecord,
        ],
      },
    });

    renderGraph(new Map());

    expect(screen.getByTitle('Model: gemini-3-pro')).toBeDefined();
    expect(screen.queryByTitle('Model: claude-sonnet-4-5')).toBeNull();
    const note = screen.getByTestId('routing-divergence');
    expect(note.textContent).toBe('Sonnet 4.5');
    expect(note.className).toContain('line-through');
  });

  it('shows the provider the agent runs on instead of guessing it from the model id', () => {
    renderGraph(new Map(), vi.fn(), { 'agent-2': 'cursor' });

    const chip = screen.getByRole('button', { name: /Implement/ });

    expect(chip.outerHTML).toContain(brandColor('cursor'));
    expect(chip.outerHTML).not.toContain(brandColor('codex'));
  });

  it('says a delegate row is answering for the step that asked', () => {
    const delegate = agent({
      id: 'delegate-1' as AgentId,
      parentAgentId: scout.id,
      ordinal: 0,
      name: 'answer: pick a database',
      status: 'running',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
    });

    renderGraph(new Map([[scout.id, [delegate]]]));

    expect(screen.getByTestId('answers-for-delegate-1').textContent).toBe('answering for Scout');
  });

  it('leaves an ordinary sub-agent row without an answering line', () => {
    renderGraph(new Map([[scout.id, [subScout(0, 'running')]]]));

    expect(screen.queryByTestId('answers-for-child-0')).toBeNull();
  });

  it('requires written evidence before resolving an open cluster hold', () => {
    const child = subScout(1, 'failed');
    const resolveClusterCompletionHold = vi.fn(async () => undefined);
    const hold: ClusterCompletionHold = {
      id: 'hold-1',
      sessionId: SESSION_ID,
      workflowRunId: null,
      containerAgentId: scout.id,
      sourceAgentId: child.id,
      sourceTurnId: 'turn-1',
      reason: 'unresolved-outcome',
      findings: [{ reason: 'network proof is missing', target: 'tester' }],
      state: 'open',
      resolutionEvidence: null,
      resolvedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [hold] },
      resolveClusterCompletionHold,
    });

    renderGraph(new Map([[scout.id, [child]]]));
    fireEvent.click(screen.getByRole('button', { name: 'Resolve hold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(resolveClusterCompletionHold).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Resolution evidence' }), {
      target: { value: 'Verified the network proof against the saved run.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(screen.getByText(/Held: network proof is missing/)).toBeDefined();
    expect(resolveClusterCompletionHold).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      holdId: 'hold-1',
      resolutionEvidence: 'Verified the network proof against the saved run.',
    });
  });

  it('shows an orphaned child hold on its surviving container', () => {
    const resolveClusterCompletionHold = vi.fn(async () => undefined);
    const hold: ClusterCompletionHold = {
      id: 'hold-orphaned',
      sessionId: SESSION_ID,
      workflowRunId: null,
      containerAgentId: scout.id,
      sourceAgentId: 'deleted-child' as AgentId,
      sourceTurnId: 'turn-deleted',
      reason: 'missing-outcome',
      findings: [],
      state: 'open',
      resolutionEvidence: null,
      resolvedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [hold] },
      resolveClusterCompletionHold,
    });

    renderGraph(new Map());

    const containerButton = screen.getByRole('button', { name: /^1 Scout/u });
    expect(containerButton.parentElement?.textContent).toContain(
      'Held: completion outcome missing',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resolve hold' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Resolution evidence' }), {
      target: { value: 'Reviewed the tombstoned child transcript.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(resolveClusterCompletionHold).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      holdId: 'hold-orphaned',
      resolutionEvidence: 'Reviewed the tombstoned child transcript.',
    });
  });

  const orphanedHold = (state: ClusterCompletionHold['state']): ClusterCompletionHold => ({
    id: 'hold-orphaned',
    sessionId: SESSION_ID,
    workflowRunId: null,
    containerAgentId: scout.id,
    sourceAgentId: 'deleted-child' as AgentId,
    sourceTurnId: 'turn-deleted',
    reason: 'unresolved-outcome',
    findings: [{ reason: 'the guard is missing', target: 'implementer' }],
    state,
    resolutionEvidence: state === 'resolved' ? 'checked by hand' : null,
    resolvedAt: state === 'resolved' ? NOW : null,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const orphanedObligation: CapabilityObligation = {
    id: 'obligation-orphaned',
    sessionId: SESSION_ID,
    workflowRunId: null,
    identity: 'deleted-child:implementer:repair',
    requesterAgentId: 'deleted-child' as AgentId,
    requesterParentAgentId: null,
    targetRole: 'implementer',
    purpose: 'repair',
    state: 'open',
    ownerAgentId: null,
    decision: null,
    decisionReason: null,
    satisfiedRevision: null,
    childAgentId: null,
    deliveredAt: null,
    deliveryReceipt: null,
    requests: [],
    holdIds: ['hold-orphaned'],
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('shows an open obligation of a removed requester on its container and acts on it there', () => {
    const resolveClusterCompletionHold = vi.fn(async () => undefined);
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [orphanedHold('open')] },
      capabilityObligations: { [SESSION_ID]: [orphanedObligation] },
      resolveClusterCompletionHold,
    });

    renderGraph(new Map());

    const containerRow = screen.getByRole('button', { name: /^1 Scout/u }).parentElement;
    expect(containerRow?.textContent).toContain('Needs: implementer for repair');
    expect(containerRow?.textContent).toContain('Held: the guard is missing');
    fireEvent.click(screen.getByRole('button', { name: 'Resolve hold' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Resolution evidence' }), {
      target: { value: 'Applied the missing guard by hand.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(resolveClusterCompletionHold).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      holdId: 'hold-orphaned',
      resolutionEvidence: 'Applied the missing guard by hand.',
    });
  });

  it('keeps an open obligation of a removed requester on its container once its hold is resolved', () => {
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [orphanedHold('resolved')] },
      capabilityObligations: { [SESSION_ID]: [orphanedObligation] },
    });

    renderGraph(new Map());

    const containerRow = screen.getByRole('button', { name: /^1 Scout/u }).parentElement;
    expect(containerRow?.textContent).toContain('Needs: implementer for repair');
    expect(containerRow?.textContent).not.toContain('Held:');
  });

  it('shows a need of a removed requester with no hold on its container and decides it there', () => {
    const decideCapabilityNeed = vi.fn(async () => ({
      kind: 'unavailable' as const,
      reason: 'the orchestrator did not answer this need',
    }));
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [] },
      capabilityObligations: {
        [SESSION_ID]: [{ ...orphanedObligation, holdIds: [], requesterParentAgentId: scout.id }],
      },
      decideCapabilityNeed,
    });

    renderGraph(new Map());

    const containerRow = screen.getByRole('button', { name: /^1 Scout/u }).parentElement;
    expect(containerRow?.textContent).toContain('Needs: implementer for repair');
    fireEvent.click(screen.getByRole('button', { name: 'Decide again' }));

    expect(decideCapabilityNeed).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      obligationId: 'obligation-orphaned',
    });
  });

  it('keeps a need of a removed requester off a container it never belonged to', () => {
    useAppStore.setState({
      clusterCompletionHolds: { [SESSION_ID]: [] },
      capabilityObligations: {
        [SESSION_ID]: [
          { ...orphanedObligation, holdIds: [], requesterParentAgentId: implement.id },
        ],
      },
    });

    renderGraph(new Map());

    const scoutRow = screen.getByRole('button', { name: /^1 Scout/u }).parentElement;
    const implementRow = screen.getByRole('button', { name: /^2 Implement/u }).parentElement;
    expect(scoutRow?.textContent).not.toContain('Needs:');
    expect(implementRow?.textContent).toContain('Needs: implementer for repair');
  });

  it('leaves an obligation on its visible requester and off the container', () => {
    const child = subScout(1, 'running');
    useAppStore.setState({
      clusterCompletionHolds: {
        [SESSION_ID]: [{ ...orphanedHold('open'), sourceAgentId: child.id }],
      },
      capabilityObligations: {
        [SESSION_ID]: [{ ...orphanedObligation, requesterAgentId: child.id }],
      },
    });

    renderGraph(new Map([[scout.id, [child]]]));

    const containerRow = screen.getByRole('button', { name: /^1 Scout/u }).parentElement;
    const childRow = screen.getByRole('button', { name: /Scout area 1/u }).parentElement;
    expect(containerRow?.textContent).not.toContain('Needs:');
    expect(childRow?.textContent).toContain('Needs: implementer for repair');
  });
});
