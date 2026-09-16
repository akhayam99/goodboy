import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import type { ArtifactSpawnActions } from '../artifacts/artifactCreationAdapter';
import type { ArtifactReportDraft } from '../../store/slices/artifactDrafts/types';
import { reportCreationAdapter } from './reportCreationAdapter';

const SESSION_ID = 'session-harborline' as SessionId;
const RUN_ID = 'run-northwind-2' as WorkflowRunId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;

const draft = (overrides: Partial<ArtifactReportDraft> = {}): ArtifactReportDraft => ({
  kind: 'report',
  reportType: 'session-summary',
  brief: '',
  basedOn: { kind: 'session' },
  routing: null,
  updatedAt: NOW,
  ...overrides,
});

const actions = (): ArtifactSpawnActions & {
  readonly spawnReportAgent: Mock;
  readonly spawnWireframeAgent: Mock;
} => ({
  spawnReportAgent: vi.fn(async () => 'agent-report' as AgentId),
  spawnWireframeAgent: vi.fn(async () => 'agent-wireframe' as AgentId),
});

describe('reportCreationAdapter', () => {
  it('passes the draft to the spawn without focus and without evidence', async () => {
    const spies = actions();
    await reportCreationAdapter.spawn({
      actions: spies,
      sessionId: SESSION_ID,
      draft: draft({
        reportType: 'change-summary',
        brief: '  what changed in ledger-core  ',
        basedOn: { kind: 'workflow-run', workflowRunId: RUN_ID },
      }),
    });
    expect(spies.spawnReportAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      reportType: 'change-summary',
      workflowRunId: RUN_ID,
      routing: null,
      brief: 'what changed in ledger-core',
      focus: 'none',
    });
    expect(spies.spawnWireframeAgent).not.toHaveBeenCalled();
  });

  it('sends a null brief when nothing was typed', async () => {
    const spies = actions();
    await reportCreationAdapter.spawn({ actions: spies, sessionId: SESSION_ID, draft: draft() });
    expect(spies.spawnReportAgent.mock.calls[0]?.[0]).toMatchObject({
      brief: null,
      workflowRunId: null,
    });
  });

  it('shows the default request the pack really sends', () => {
    expect(reportCreationAdapter.defaultRequest({ choice: 'session-summary' })).toBe(
      'write a session summary: what the session set out to do, what landed, what is still open.',
    );
  });

  it('names the mount and both branches in the repo line', () => {
    expect(
      reportCreationAdapter.repoLine({
        choice: 'session-summary',
        repo: { mountName: 'ledger-core', branch: 'ak/fix-rounding', baseBranch: 'main' },
      }),
    ).toBe('local change evidence from ledger-core on ak/fix-rounding, against main.');
    expect(reportCreationAdapter.repoLine({ choice: 'session-summary', repo: null })).toBe(
      'no mounted project, so no local change evidence.',
    );
  });
});
