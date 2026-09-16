import { runsForWorkflowRun } from '@goodboy/core';
import type { IsoDateTime, Session, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { buildReportContext } from '../reports/buildReportContext';
import { collectReportDiffEvidence } from '../reports/collectReportDiffEvidence';
import type { ReportType } from '../reports/reportTypes';
import { buildWireframeContext } from '../wireframes/buildWireframeContext';
import { collectWireframeDesignProfile } from '../wireframes/collectWireframeDesignProfile';
import { describeDesignProfile } from '../wireframes/describeDesignProfile';
import type { WireframeFidelity } from '../wireframes/wireframeFidelity';
import { artifactEvidenceInventory, type RecordArtifactProvenanceArgs } from './artifactProvenance';

type Params = Readonly<{
  state: AppState;
  session: Session;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
}> &
  (
    | Readonly<{ kind: 'report'; reportType: ReportType }>
    | Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity }>
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
  ...choice
}: Params): Promise<PreparedEvidence> => {
  const sessionId = session.id;
  const agents = state.sessionPhaseRuns?.[sessionId] ?? [];
  const artifacts = state.sessionArtifacts?.[sessionId] ?? [];
  const transcripts = state.transcripts ?? {};
  if (choice.kind === 'report') {
    const diff = await collectReportDiffEvidence({ state, sessionId });
    const context = buildReportContext({
      reportType: choice.reportType,
      brief,
      session,
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
    brief,
    session,
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
