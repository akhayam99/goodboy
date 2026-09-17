import { runsForWorkflowRun } from '@goodboy/core';
import type { AgentId, IsoDateTime, Session, WorkflowRunId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { buildReportContext, type ReportScoutEvidence } from '../reports/buildReportContext';
import { collectReportDiffEvidence } from '../reports/collectReportDiffEvidence';
import type { ReportType } from '../reports/reportTypes';
import { buildWireframeContext } from '../wireframes/buildWireframeContext';
import type { DesignEvidence } from '../wireframes/collectDesignProfile';
import { collectWireframeDesignProfile } from '../wireframes/collectWireframeDesignProfile';
import { describeDesignProfile } from '../wireframes/describeDesignProfile';
import { hasDesignEvidence } from '../wireframes/hasDesignEvidence';
import type { WireframeFidelity } from '../wireframes/wireframeFidelity';
import type { WireframeScoutPlan } from '../wireframes/wireframeScoutPlan';
import type { WireframeTarget } from '../wireframes/wireframeTarget';
import type { ArtifactAttachment } from './artifactAttachments';
import { artifactEvidenceAgents } from './artifactEvidenceAgents';
import { artifactEvidenceInventory, type RecordArtifactProvenanceArgs } from './artifactProvenance';
import { sessionGoalText } from './sessionGoalText';

type Params = Readonly<{
  state: AppStore;
  session: Session;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  executingAgentId: AgentId | null;
}> &
  (
    | Readonly<{ kind: 'report'; reportType: ReportType; scouts?: ReportScoutEvidence | null }>
    | Readonly<{
        kind: 'wireframe';
        fidelity: WireframeFidelity;
        target: WireframeTarget;
        scoutPlan?: WireframeScoutPlan | null;
        scoutSection?: string | null;
      }>
  );

type PreparedEvidence = Readonly<{
  text: string;
  provenance: Omit<RecordArtifactProvenanceArgs, 'agentId' | 'executingWorkflowRunId'>;
}>;

export const prepareArtifactEvidence = async ({
  state,
  session,
  workflowRunId,
  brief,
  attachments,
  executingAgentId,
  ...choice
}: Params): Promise<PreparedEvidence> => {
  const sessionId = session.id;
  const artifacts = state.sessionArtifacts?.[sessionId] ?? [];
  const transcripts = state.transcripts ?? {};
  const agents = artifactEvidenceAgents({
    agents: state.sessionPhaseRuns?.[sessionId] ?? [],
    transcripts,
    executingAgentId,
  });
  const slots = await state.ensureSessionSlots(sessionId);
  const goal = sessionGoalText({ slots, session });
  if (choice.kind === 'report') {
    const diff = await collectReportDiffEvidence({ state, sessionId });
    const context = buildReportContext({
      reportType: choice.reportType,
      brief,
      attachments,
      session,
      goal,
      agents,
      transcripts,
      artifacts,
      events: state.sessionEvents?.[sessionId] ?? [],
      scriptRuns: state.scriptRuns?.[sessionId] ?? {},
      diff: diff.evidence,
      diffUnavailableReason: diff.reason,
      scouts: choice.scouts ?? null,
      workflowRunId,
      capturedAt: new Date().toISOString() as IsoDateTime,
    });
    return {
      text: context.text,
      provenance: {
        sessionId,
        kind: choice.kind,
        brief,
        evidence: artifactEvidenceInventory({
          sourceIds: context.sourceIds,
          session,
          agents,
          artifacts,
          sourceWorkflowRunId: workflowRunId,
        }),
        omissions: context.truncations,
        designProfileSummary: null,
        hasDesignEvidence: false,
        phase: 'producing',
        scoutPlan: [],
        mountIds: [],
        target: null,
        deadlineAt: null,
        sourceWorkflowRunId: workflowRunId,
      },
    };
  }
  const designEvidence: DesignEvidence =
    choice.fidelity === 'high'
      ? await collectWireframeDesignProfile({ state, sessionId })
      : { source: 'none' };
  const context = buildWireframeContext({
    fidelity: choice.fidelity,
    target: choice.target,
    brief,
    attachments,
    session,
    goal,
    agents: workflowRunId === null ? agents : runsForWorkflowRun(agents, workflowRunId),
    transcripts,
    artifacts,
    designEvidence,
    scoutPlan: choice.scoutPlan ?? null,
    scoutSection: choice.scoutSection ?? null,
    capturedAt: new Date().toISOString() as IsoDateTime,
  });
  return {
    text: context.text,
    provenance: {
      sessionId,
      kind: choice.kind,
      brief,
      evidence: artifactEvidenceInventory({
        sourceIds: context.sourceIds,
        session,
        agents,
        artifacts,
        sourceWorkflowRunId: workflowRunId,
      }),
      omissions: context.truncations,
      designProfileSummary:
        designEvidence.source === 'none'
          ? null
          : describeDesignProfile({ profile: designEvidence.profile }),
      hasDesignEvidence:
        designEvidence.source !== 'none' && hasDesignEvidence({ profile: designEvidence.profile }),
      phase: 'producing',
      scoutPlan: [],
      mountIds: [],
      target: choice.target,
      deadlineAt: null,
      sourceWorkflowRunId: workflowRunId,
    },
  };
};
