import { useEffect, useState } from 'react';
import { runsForWorkflowRun } from '@goodboy/core';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectActiveMount } from '../../../../../store/slices/project-mounts/selectors';
import type { AppStore } from '../../../../../store/store';
import type { ArtifactBasedOn } from '../../../../../store/slices/artifactDrafts/types';
import { buildReportContext, REPORT_CONTEXT_LIMITS } from '../../../../reports/buildReportContext';
import { collectReportDiffEvidence } from '../../../../reports/collectReportDiffEvidence';
import { asReportType } from '../../../../reports/reportTypes';
import {
  buildWireframeContext,
  WIREFRAME_CONTEXT_LIMITS,
} from '../../../../wireframes/buildWireframeContext';
import { collectWireframeDesignProfile } from '../../../../wireframes/collectWireframeDesignProfile';
import { asWireframeFidelity } from '../../../../wireframes/wireframeFidelity';
import { asWireframeTarget } from '../../../../wireframes/wireframeTarget';
import type { ArtifactContextInventoryRow } from '../../../artifactContextInventory';
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
    const diff = await collectReportDiffEvidence({ state, sessionId });
    const context = buildReportContext({
      reportType: asReportType({ value: choice }) ?? 'session-summary',
      brief: null,
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
  const designProfile =
    fidelity === 'high' ? await collectWireframeDesignProfile({ state, sessionId }) : null;
  const context = buildWireframeContext({
    fidelity,
    target: asWireframeTarget({ value: secondChoice }) ?? 'both',
    brief: null,
    session,
    goal,
    agents: workflowRunId === null ? agents : runsForWorkflowRun(agents, workflowRunId),
    transcripts,
    artifacts: state.sessionArtifacts?.[sessionId] ?? [],
    designProfile,
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
}: Params): ArtifactContextPreview => {
  const [preview, setPreview] = useState<ArtifactContextPreview>(EMPTY);
  const mountRevision = useAppStore(
    (s) => selectActiveMount({ state: s, sessionId })?.revision ?? null,
  );
  const scopeKey = basedOn.kind === 'workflow-run' ? basedOn.workflowRunId : '';

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
  }, [sessionId, kind, scopeKey, choice, secondChoice, mountRevision]);

  return preview;
};
