import { useEffect, useState } from 'react';
import { runsForWorkflowRun } from '@goodboy/core';
import type { IsoDateTime, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import type { ArtifactBasedOn } from '../../../../../store/slices/artifactDrafts/types';
import { buildReportContext, REPORT_CONTEXT_LIMITS } from '../../../../reports/buildReportContext';
import { collectReportDiffEvidence } from '../../../../reports/collectReportDiffEvidence';
import { asReportType } from '../../../../reports/reportTypes';
import {
  buildWireframeContext,
  WIREFRAME_CONTEXT_LIMITS,
} from '../../../../wireframes/buildWireframeContext';
import type { DesignEvidence } from '../../../../wireframes/collectDesignProfile';
import { collectWireframeDesignProfile } from '../../../../wireframes/collectWireframeDesignProfile';
import { collectWireframeScoutPlan } from '../../../../wireframes/collectWireframeScoutPlan';
import { asWireframeFidelity } from '../../../../wireframes/wireframeFidelity';
import { asWireframeTarget } from '../../../../wireframes/wireframeTarget';
import type { ArtifactAttachment } from '../../../artifactAttachments';
import type { ArtifactContextInventoryRow } from '../../../artifactContextInventory';
import { selectArtifactMountOptions } from '../../../artifactMountChoice';
import { artifactEvidenceAgents } from '../../../artifactEvidenceAgents';
import { sessionGoalText } from '../../../sessionGoalText';
import type { GeneratedArtifactKind } from '../../../artifactCollection';

export type ArtifactContextPreview = Readonly<{
  status: 'collecting' | 'ready';
  inventory: ReadonlyArray<ArtifactContextInventoryRow>;
  truncations: ReadonlyArray<string>;
  size: number;
  cap: number;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  kind: GeneratedArtifactKind;
  basedOn: ArtifactBasedOn;
  choice: string;
  secondChoice: string;
  attachments: ReadonlyArray<ArtifactAttachment>;
  mountIds: ReadonlyArray<MountId>;
}>;

const DEBOUNCE_MS = 300;

const EMPTY: ArtifactContextPreview = {
  status: 'collecting',
  inventory: [],
  truncations: [],
  size: 0,
  cap: 0,
};

type CollectParams = Params &
  Readonly<{
    state: AppStore;
  }>;

const collect = async ({
  state,
  sessionId,
  kind,
  basedOn,
  choice,
  secondChoice,
  attachments,
  mountIds,
}: CollectParams): Promise<ArtifactContextPreview | null> => {
  const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
  if (session === null) {
    return null;
  }
  const workflowRunId = basedOn.kind === 'workflow-run' ? basedOn.workflowRunId : null;
  const capturedAt = new Date().toISOString() as IsoDateTime;
  const transcripts = state.transcripts ?? {};
  const agents = artifactEvidenceAgents({
    agents: state.sessionPhaseRuns?.[sessionId] ?? [],
    transcripts,
    executingAgentId: null,
  });
  const slots = await state.ensureSessionSlots(sessionId);
  const goal = sessionGoalText({ slots, session });
  if (kind === 'report') {
    const diff = await collectReportDiffEvidence({ state, sessionId, mountIds });
    const context = buildReportContext({
      reportType: asReportType({ value: choice }) ?? 'session-summary',
      brief: null,
      attachments,
      session,
      goal,
      agents,
      transcripts,
      artifacts: state.sessionArtifacts?.[sessionId] ?? [],
      events: state.sessionEvents?.[sessionId] ?? [],
      scriptRuns: state.scriptRuns?.[sessionId] ?? {},
      diff: diff.evidence,
      diffUnavailableReason: diff.reason,
      workflowRunId,
      capturedAt,
    });
    return {
      status: 'ready',
      inventory: context.inventory,
      truncations: context.truncations,
      size: context.text.length,
      cap: REPORT_CONTEXT_LIMITS.total,
    };
  }
  const fidelity = asWireframeFidelity({ value: choice }) ?? 'low';
  const designEvidence: DesignEvidence =
    fidelity === 'high'
      ? await collectWireframeDesignProfile({ state, sessionId, mountIds })
      : { source: 'none' };
  const scouting = await collectWireframeScoutPlan({
    state,
    sessionId,
    workflowRunId,
    mountIds,
    goal: goal.packText,
    brief: null,
  });
  const context = buildWireframeContext({
    fidelity,
    target: asWireframeTarget({ value: secondChoice }) ?? 'both',
    brief: null,
    attachments,
    session,
    goal,
    agents: workflowRunId === null ? agents : runsForWorkflowRun(agents, workflowRunId),
    transcripts,
    artifacts: state.sessionArtifacts?.[sessionId] ?? [],
    designEvidence,
    scoutPlan: scouting.plan,
    capturedAt,
  });
  return {
    status: 'ready',
    inventory: context.inventory,
    truncations: context.truncations,
    size: context.text.length,
    cap: WIREFRAME_CONTEXT_LIMITS.total,
  };
};

export const useArtifactContextPreview = ({
  sessionId,
  kind,
  basedOn,
  choice,
  secondChoice,
  attachments,
  mountIds,
}: Params): ArtifactContextPreview => {
  const [preview, setPreview] = useState<ArtifactContextPreview>(EMPTY);
  const mountRevision = useAppStore((s) =>
    selectArtifactMountOptions({ state: s, sessionId })
      .filter((option) => mountIds.includes(option.mountId))
      .map((option) => `${option.mountId}:${option.worktreePath}:${option.revision}`)
      .join('|'),
  );
  const scopeKey = basedOn.kind === 'workflow-run' ? basedOn.workflowRunId : '';
  const attachmentsKey = attachments.map((attachment) => attachment.relPath).join('|');
  const mountKey = mountIds.join('|');

  useEffect(() => {
    let isCurrent = true;
    setPreview((current) => ({ ...current, status: 'collecting' }));
    const timer = window.setTimeout(() => {
      collect({
        state: useAppStore.getState(),
        sessionId,
        kind,
        basedOn:
          scopeKey === '' ? { kind: 'session' } : { kind: 'workflow-run', workflowRunId: scopeKey },
        choice,
        secondChoice,
        attachments,
        mountIds,
      })
        .then((next) => {
          if (isCurrent && next !== null) {
            setPreview(next);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setPreview((current) => ({ ...current, status: 'ready' }));
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [sessionId, kind, scopeKey, choice, secondChoice, attachmentsKey, mountKey, mountRevision]);

  return preview;
};
