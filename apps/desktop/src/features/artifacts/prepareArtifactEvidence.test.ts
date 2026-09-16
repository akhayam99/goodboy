import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppState } from '../../store/types';
import { REPORT_CONTEXT_LIMITS } from '../reports/buildReportContext';
import { prepareArtifactEvidence } from './prepareArtifactEvidence';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;
const session: Session = {
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'show the session inbox',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};
const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'scout',
  status: 'completed',
};
const state = {
  sessions: [session],
  sessionPhaseRuns: { [SESSION_ID]: [agent] },
  transcripts: {
    [AGENT_ID]: [
      {
        kind: 'assistant_text',
        runId: 'turn-1',
        at: NOW,
        delta: 'x'.repeat(REPORT_CONTEXT_LIMITS.agentText + 1),
      },
    ],
  },
} as unknown as AppState;

const EXECUTING_ID = 'agent-2' as AgentId;
const executing: Agent = {
  id: EXECUTING_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  ordinal: 1,
  name: 'Session summary',
  status: 'pending',
};

type WithExecutingParams = Readonly<{ transcript: boolean }>;

const withExecuting = ({ transcript }: WithExecutingParams): AppState =>
  ({
    ...state,
    sessionPhaseRuns: { [SESSION_ID]: [agent, executing] },
    transcripts: {
      ...state.transcripts,
      ...(transcript
        ? {
            [EXECUTING_ID]: [
              { kind: 'assistant_text', runId: 'turn-2', at: NOW, delta: 'a discarded first try' },
            ],
          }
        : {}),
    },
  }) as unknown as AppState;

describe('prepareArtifactEvidence', () => {
  it('carries report omissions and source labels into provenance', async () => {
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      executingAgentId: null,
      kind: 'report',
      reportType: 'session-summary',
    });
    expect(prepared.provenance.evidence).toEqual([
      { kind: 'session', id: SESSION_ID, label: session.goal },
      { kind: 'workflow-run', id: RUN_ID, label: 'workflow run' },
      { kind: 'agent', id: AGENT_ID, label: 'scout' },
    ]);
    expect(prepared.provenance.omissions).toContain('agent agent-1: final message truncated');
    expect(prepared.text).toContain('agent agent-1: final message truncated');
  });

  it('degrades a high fidelity request without a mount to an explicit generic theme', async () => {
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      executingAgentId: null,
      kind: 'wireframe',
      target: 'both',
      fidelity: 'high',
    });
    expect(prepared.text).toContain('the app collected no design profile');
    expect(prepared.text).toContain('never invent branding');
    expect(prepared.provenance.designProfileSummary).toBeNull();
    expect(prepared.provenance.sourceWorkflowRunId).toBe(RUN_ID);
  });

  it.each(['report', 'wireframe'] as const)(
    'never packs the executing agent into its own %s',
    async (kind) => {
      const prepared = await prepareArtifactEvidence({
        state: withExecuting({ transcript: true }),
        session,
        workflowRunId: RUN_ID,
        brief: null,
        executingAgentId: EXECUTING_ID,
        ...(kind === 'report'
          ? { kind: 'report' as const, reportType: 'session-summary' as const }
          : { kind: 'wireframe' as const, fidelity: 'low' as const, target: 'both' as const }),
      });
      expect(prepared.text).not.toContain(EXECUTING_ID);
      expect(prepared.text).not.toContain('a discarded first try');
      expect(prepared.provenance.evidence.map((entry) => entry.id)).not.toContain(EXECUTING_ID);
      expect(prepared.provenance.evidence).toContainEqual({
        kind: 'agent',
        id: AGENT_ID,
        label: 'scout',
      });
    },
  );

  it('leaves out a pending agent that has produced nothing', async () => {
    const prepared = await prepareArtifactEvidence({
      state: withExecuting({ transcript: false }),
      session,
      workflowRunId: RUN_ID,
      brief: null,
      executingAgentId: null,
      kind: 'report',
      reportType: 'session-summary',
    });
    expect(prepared.text).not.toContain(EXECUTING_ID);
    expect(prepared.text).not.toContain('no assistant output recorded');
    expect(prepared.provenance.evidence.map((entry) => entry.id)).not.toContain(EXECUTING_ID);
  });
});
