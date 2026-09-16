import { runsForWorkflowRun } from '@goodboy/core';
import type { AgentId, IsoDateTime, Session, WorkflowRunId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { buildReportContext } from '../reports/buildReportContext';
import { collectReportDiffEvidence } from '../reports/collectReportDiffEvidence';
import type { ReportType } from '../reports/reportTypes';
import { buildWireframeContext } from '../wireframes/buildWireframeContext';
import { collectWireframeDesignProfile } from '../wireframes/collectWireframeDesignProfile';
import { describeDesignProfile } from '../wireframes/describeDesignProfile';
import type { WireframeFidelity } from '../wireframes/wireframeFidelity';
import type { WireframeTarget } from '../wireframes/wireframeTarget';
import { artifactEvidenceAgents } from './artifactEvidenceAgents';
import { artifactEvidenceInventory, type RecordArtifactProvenanceArgs } from './artifactProvenance';
import { sessionGoalText } from './sessionGoalText';

type Params = Readonly<{
  state: AppStore;
  session: Session;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  executingAgentId: AgentId | null;
}> &
  (
    | Readonly<{ kind: 'report'; reportType: ReportType }>
    | Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity; target: WireframeTarget }>
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
      session,
      goal,
      agents,
      transcripts,
      artifacts,
      events: state.sessionEvents?.[sessionId] ?? [],
      scriptRuns: state.scriptRuns?.[sessionId] ?? {},
      diff: diff.evidence,
      diffUnavailableReason: diff.reason,
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
        sourceWorkflowRunId: workflowRunId,
      },
    };
  }
  const designProfile =
    choice.fidelity === 'high' ? await collectWireframeDesignProfile({ state, sessionId }) : null;
  const context = buildWireframeContext({
    fidelity: choice.fidelity,
    target: choice.target,
    brief,
    session,
    goal,
    agents: workflowRunId === null ? agents : runsForWorkflowRun(agents, workflowRunId),
    transcripts,
    artifacts,
    designProfile,
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
        designProfile === null ? null : describeDesignProfile({ profile: designProfile }),
      sourceWorkflowRunId: workflowRunId,
    },
  };
};
