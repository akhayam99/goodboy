import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { ContextSlot } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { ATTACHMENT_KIND_ROUTING } from '../providers/attachment-routing';
import type { ArtifactAttachment } from './artifactAttachments';
import { REPORT_CONTEXT_LIMITS } from '../reports/buildReportContext';

const { designProfile } = vi.hoisted(() => ({
  designProfile: vi.fn(async (): Promise<unknown> => ({ source: 'none' })),
}));

vi.mock('../wireframes/collectWireframeDesignProfile', () => ({
  collectWireframeDesignProfile: designProfile,
}));

import { prepareArtifactEvidence } from './prepareArtifactEvidence';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;
const SCREEN: ArtifactAttachment = {
  id: 'att-inbox',
  fileName: 'inbox.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/att-inbox-inbox.png',
};
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
const slotsBySession: Record<string, ReadonlyArray<ContextSlot>> = {};

const ensureSessionSlots = async (sessionId: string): Promise<ReadonlyArray<ContextSlot>> =>
  slotsBySession[sessionId] ?? [];

const state = {
  ensureSessionSlots,
  sessions: [session],
  sessionPhaseRuns: { [SESSION_ID]: [agent] },
  transcripts: {
    [AGENT_ID]: [
      {
        kind: 'assistant_text',
        runId: 'turn-1',
        at: NOW,
        delta: 'x'.repeat(REPORT_CONTEXT_LIMITS.total + 1_000),
      },
    ],
  },
} as unknown as AppStore;

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

const withExecuting = ({ transcript }: WithExecutingParams): AppStore =>
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
  }) as unknown as AppStore;

describe('prepareArtifactEvidence', () => {
  it('carries report omissions and source labels into provenance', async () => {
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      attachments: [],
      mountIds: [],
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
      attachments: [],
      mountIds: [],
      executingAgentId: null,
      kind: 'wireframe',
      target: 'both',
      fidelity: 'high',
    });
    expect(prepared.text).toContain('no repository is mounted, so nothing could be read');
    expect(prepared.text).toContain('never invent branding');
    expect(prepared.provenance.designProfileSummary).toBeNull();
    expect(prepared.provenance.sourceWorkflowRunId).toBe(RUN_ID);
  });

  it('records that a walked repository yielded no design file at all', async () => {
    designProfile.mockResolvedValueOnce({
      source: 'mount',
      profile: {
        themeName: 'generic',
        commitSha: 'abc1234',
        tailwind: null,
        tokens: [],
        variants: [],
        layoutExamples: [],
        notes: ['no tailwind config was found'],
      },
    });
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      attachments: [],
      mountIds: [],
      executingAgentId: null,
      kind: 'wireframe',
      target: 'both',
      fidelity: 'high',
    });
    expect(prepared.provenance.designProfileSummary).toContain('theme name: generic');
    expect(prepared.provenance.hasDesignEvidence).toBe(false);
  });

  it('records the design evidence a walked repository did yield', async () => {
    designProfile.mockResolvedValueOnce({
      source: 'mount',
      profile: {
        themeName: 'Harborline',
        commitSha: 'abc1234',
        tailwind: { path: 'tailwind.config.ts', excerpt: 'theme: {}' },
        tokens: [],
        variants: [],
        layoutExamples: [],
        notes: [],
      },
    });
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      attachments: [],
      mountIds: [],
      executingAgentId: null,
      kind: 'wireframe',
      target: 'both',
      fidelity: 'high',
    });
    expect(prepared.provenance.hasDesignEvidence).toBe(true);
  });

  it.each(['report', 'wireframe'] as const)(
    'never packs the executing agent into its own %s',
    async (kind) => {
      const prepared = await prepareArtifactEvidence({
        state: withExecuting({ transcript: true }),
        session,
        workflowRunId: RUN_ID,
        brief: null,
        attachments: [],
        mountIds: [],
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
      attachments: [],
      mountIds: [],
      executingAgentId: null,
      kind: 'report',
      reportType: 'session-summary',
    });
    expect(prepared.text).not.toContain(EXECUTING_ID);
    expect(prepared.text).not.toContain('no assistant output recorded');
    expect(prepared.provenance.evidence.map((entry) => entry.id)).not.toContain(EXECUTING_ID);
  });
});

describe('prepareArtifactEvidence session goal', () => {
  const LONG_GOAL = [
    'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
    'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
  ].join('\n\n');

  afterEach(() => {
    delete slotsBySession[SESSION_ID];
  });

  it.each(['report', 'wireframe'] as const)(
    'sends the goal the user wrote into the %s pack, not the title alone',
    async (kind) => {
      slotsBySession[SESSION_ID] = [{ key: 'goal', value: LONG_GOAL, enabled: true }];
      const prepared = await prepareArtifactEvidence({
        state,
        session,
        workflowRunId: RUN_ID,
        brief: null,
        attachments: [],
        mountIds: [],
        executingAgentId: null,
        ...(kind === 'report'
          ? { kind: 'report' as const, reportType: 'session-summary' as const }
          : { kind: 'wireframe' as const, fidelity: 'low' as const, target: 'both' as const }),
      });
      expect(prepared.text).toContain(`## goal\n\n${LONG_GOAL}`);
    },
  );

  it.each(['report', 'wireframe'] as const)(
    'sends an attached screen into the %s pack as a path to read',
    async (kind) => {
      const prepared = await prepareArtifactEvidence({
        state,
        session,
        workflowRunId: RUN_ID,
        brief: 'match this layout',
        attachments: [SCREEN],
        mountIds: [],
        executingAgentId: null,
        ...(kind === 'report'
          ? { kind: 'report' as const, reportType: 'session-summary' as const }
          : { kind: 'wireframe' as const, fidelity: 'low' as const, target: 'both' as const }),
      });
      expect(prepared.text).toContain('## attachments');
      expect(prepared.text).toContain(SCREEN.relPath);
      expect(prepared.text).toContain('read each path with your Read tool before relying on it');
    },
  );

  it.each(['report', 'wireframe'] as const)(
    'never routes a %s attachment through the agent kind table that would drop it',
    async (kind) => {
      expect(ATTACHMENT_KIND_ROUTING.image).not.toContain(kind);
      const prepared = await prepareArtifactEvidence({
        state,
        session,
        workflowRunId: RUN_ID,
        brief: null,
        attachments: [SCREEN],
        mountIds: [],
        executingAgentId: null,
        ...(kind === 'report'
          ? { kind: 'report' as const, reportType: 'session-summary' as const }
          : { kind: 'wireframe' as const, fidelity: 'low' as const, target: 'both' as const }),
      });
      expect(prepared.text).toContain(SCREEN.relPath);
    },
  );

  it('keeps the title alone when the user disabled the goal slot', async () => {
    slotsBySession[SESSION_ID] = [{ key: 'goal', value: LONG_GOAL, enabled: false }];
    const prepared = await prepareArtifactEvidence({
      state,
      session,
      workflowRunId: RUN_ID,
      brief: null,
      attachments: [],
      mountIds: [],
      executingAgentId: null,
      kind: 'report',
      reportType: 'session-summary',
    });
    expect(prepared.text).not.toContain('## goal');
    expect(prepared.text).toContain(session.goal);
  });
});
