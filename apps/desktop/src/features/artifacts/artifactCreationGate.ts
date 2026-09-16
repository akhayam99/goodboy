import type { ArtifactBasedOn } from '../../store/slices/artifactDrafts/types';
import { ARTIFACT_BRIEF_LIMITS, formatBriefCount } from './artifactBrief';
import { ARTIFACT_CTA_BLOCK_COPY, type ArtifactCtaState } from './artifactCtaState';
import type { GeneratedArtifactKind } from './artifactCollection';

export type ArtifactCreationGate = Readonly<{
  isDisabled: boolean;
  reason: string | null;
  tone: 'blocked' | 'note';
}>;

export type ArtifactCreationGateParams = Readonly<{
  kind: GeneratedArtifactKind;
  ctaState: ArtifactCtaState;
  basedOn: ArtifactBasedOn;
  hasBrief: boolean;
  isBriefOverLimit: boolean;
  hasUsableProvider: boolean;
  isStarting: boolean;
  isCollecting: boolean;
}>;

const BLOCKED = (reason: string): ArtifactCreationGate => ({
  isDisabled: true,
  reason,
  tone: 'blocked',
});

const NOTE = (reason: string): ArtifactCreationGate => ({
  isDisabled: false,
  reason,
  tone: 'note',
});

const NO_EVIDENCE_REPORT_RUN =
  'this run has no finished work yet, so there is nothing to report on. base it on the session, or wait for the run';

const NO_EVIDENCE_REPORT_SESSION =
  'nothing has run yet, so there is nothing to report on. run an agent or a workflow first';

const NO_EVIDENCE_WIREFRAME_BRIEF =
  'nothing has run yet, so this wireframe comes from your brief alone';

const NO_EVIDENCE_WIREFRAME_EMPTY =
  'describe the screen or flow. nothing has run yet to draw it from';

const COLLECTING = 'context is still being collected, Generate collects again anyway';

const noEvidenceGate = ({
  kind,
  basedOn,
  hasBrief,
}: Pick<ArtifactCreationGateParams, 'kind' | 'basedOn' | 'hasBrief'>): ArtifactCreationGate => {
  if (kind === 'report') {
    return BLOCKED(
      basedOn.kind === 'workflow-run' ? NO_EVIDENCE_REPORT_RUN : NO_EVIDENCE_REPORT_SESSION,
    );
  }
  return hasBrief ? NOTE(NO_EVIDENCE_WIREFRAME_BRIEF) : BLOCKED(NO_EVIDENCE_WIREFRAME_EMPTY);
};

export const artifactCreationGate = ({
  kind,
  ctaState,
  basedOn,
  hasBrief,
  isBriefOverLimit,
  hasUsableProvider,
  isStarting,
  isCollecting,
}: ArtifactCreationGateParams): ArtifactCreationGate => {
  if (isStarting) {
    return BLOCKED('this generation is already starting');
  }
  if (ctaState.kind === 'blocked' && ctaState.reason === 'run-active') {
    return BLOCKED(ARTIFACT_CTA_BLOCK_COPY['run-active']);
  }
  if (ctaState.kind === 'blocked' && ctaState.reason === 'session-busy') {
    return BLOCKED(ARTIFACT_CTA_BLOCK_COPY['session-busy']);
  }
  if (isBriefOverLimit) {
    return BLOCKED(
      `shorten the brief to ${formatBriefCount({ value: ARTIFACT_BRIEF_LIMITS.chars })} characters`,
    );
  }
  if (!hasUsableProvider) {
    return BLOCKED('connect a provider to generate');
  }
  if (ctaState.kind === 'blocked' && ctaState.reason === 'no-evidence') {
    return noEvidenceGate({ kind, basedOn, hasBrief });
  }
  if (isCollecting) {
    return NOTE(COLLECTING);
  }
  return { isDisabled: false, reason: null, tone: 'note' };
};
