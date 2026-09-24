// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AgentId,
  ArtifactId,
  ArtifactProvenance,
  IsoDateTime,
  SessionArtifact,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';

const { loadArtifactProvenance } = vi.hoisted(() => ({ loadArtifactProvenance: vi.fn() }));

vi.mock('../../../artifactProvenance', () => ({ loadArtifactProvenance }));

import { ArtifactBuiltFrom } from './index';

const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;

const report: SessionArtifact = {
  id: 'artifact-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'change summary',
  sourceFormat: 'markdown',
  sourceText: '## outcome',
  metadata: { reportType: 'change-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'turn-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const wireframe: SessionArtifact = {
  ...report,
  kind: 'wireframe',
  sourceFormat: 'json',
  sourceText: '{"screens":[]}',
  metadata: { fidelity: 'low', designProfile: {} },
};

const provenance: ArtifactProvenance = {
  agentId: AGENT_ID,
  sessionId: SESSION_ID,
  kind: 'report',
  brief: 'explain what ledger-core changed',
  evidence: [
    { kind: 'session', id: SESSION_ID, label: 'ship notify-relay' },
    { kind: 'agent', id: AGENT_ID, label: 'Harborline reviewer' },
  ],
  omissions: ['agents: kept the last 12 of 30'],
  designProfileSummary: null,
  hasDesignEvidence: false,
  phase: 'done',
  scoutPlan: [],
  mountIds: [],
  target: null,
  deadlineAt: null,
  sourceWorkflowRunId: null,
  executingWorkflowRunId: null,
  createdAt: NOW,
};

const renderWith = async (value: ArtifactProvenance | null, artifact: SessionArtifact = report) => {
  loadArtifactProvenance.mockResolvedValueOnce(value);
  render(<ArtifactBuiltFrom artifact={artifact} />);
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Loading built from' })).toBeNull(),
  );
};

describe('ArtifactBuiltFrom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('holds the section with a skeleton while provenance loads', () => {
    loadArtifactProvenance.mockReturnValueOnce(new Promise(() => undefined));
    render(<ArtifactBuiltFrom artifact={report} />);

    expect(screen.getByLabelText('Built from')).toBeDefined();
    expect(screen.getByRole('status', { name: 'Loading built from' })).toBeDefined();
  });

  it('tells a failed load apart from a missing record and retries it', async () => {
    loadArtifactProvenance.mockRejectedValueOnce(new Error('database is locked'));
    render(<ArtifactBuiltFrom artifact={report} />);

    expect(await screen.findByTestId('built-from-failed')).toBeDefined();
    expect(screen.queryByTestId('built-from-missing')).toBeNull();

    loadArtifactProvenance.mockResolvedValueOnce(provenance);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByTestId('built-from')).toBeDefined();
  });

  it('says plainly that an older artifact recorded nothing', async () => {
    await renderWith(null);
    expect(screen.getByTestId('built-from-missing').textContent).toContain(
      'nothing was recorded for this generation',
    );
    expect(screen.queryByTestId('built-from')).toBeNull();
  });

  it('shows the brief, the scope and what was left out', async () => {
    await renderWith(provenance);
    expect(screen.getByText('explain what ledger-core changed')).toBeTruthy();
    expect(screen.getByText('The whole session')).toBeTruthy();
    expect(screen.getByText('No workflow step, this agent ran on its own')).toBeTruthy();
    expect(screen.getByText('agents: kept the last 12 of 30')).toBeTruthy();
    expect(screen.getAllByTestId('built-from-evidence')).toHaveLength(2);
  });

  it('keeps the source workflow run apart from the executing one', async () => {
    await renderWith({
      ...provenance,
      sourceWorkflowRunId: RUN_ID,
      executingWorkflowRunId: null,
    });
    expect(screen.getByText(/^Workflow run run-1\. Agents and artifacts were scoped/)).toBeTruthy();
    expect(screen.getByText('No workflow step, this agent ran on its own')).toBeTruthy();
  });

  it('does not claim a wireframe run limited the session plans', async () => {
    await renderWith(
      {
        ...provenance,
        kind: 'wireframe',
        sourceWorkflowRunId: RUN_ID,
        executingWorkflowRunId: RUN_ID,
        designProfileSummary: 'theme name: Harborline',
      },
      wireframe,
    );
    expect(
      screen.getByText(
        'Workflow run run-1. Agents were scoped to that run, session plans were not',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Workflow run run-1')).toBeTruthy();
    expect(screen.queryByTestId('built-from-design-profile')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'design profile' }));
    expect(screen.getByTestId('built-from-design-profile').textContent).toBe(
      'theme name: Harborline',
    );
  });

  it('says nothing was dropped when the pack carried everything', async () => {
    await renderWith({ ...provenance, brief: null, omissions: [] });
    expect(screen.getByText('No brief was given')).toBeTruthy();
    expect(screen.getByText('Nothing was dropped from the pack')).toBeTruthy();
  });

  it('collapses a long evidence list until it is asked to show all', async () => {
    const evidence = Array.from({ length: 8 }, (_, index) => ({
      kind: 'agent' as const,
      id: `agent-${index}`,
      label: `agent ${index}`,
    }));
    await renderWith({ ...provenance, evidence });
    expect(screen.getAllByTestId('built-from-evidence')).toHaveLength(5);
    fireEvent.click(screen.getByTestId('built-from-evidence-more'));
    expect(screen.getAllByTestId('built-from-evidence')).toHaveLength(8);
  });
});
