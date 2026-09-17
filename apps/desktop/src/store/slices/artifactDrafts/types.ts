import type {
  AgentEffort,
  IsoDateTime,
  MountId,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { ArtifactAttachment } from '../../../features/artifacts/artifactAttachments';
import type { GeneratedArtifactKind } from '../../../features/artifacts/artifactCollection';
import type { ReportType } from '../../../features/reports/reportTypes';
import type { WireframeFidelity } from '../../../features/wireframes/wireframeFidelity';
import type { WireframeTarget } from '../../../features/wireframes/wireframeTarget';

export type { SetFn, GetFn } from '../../slice-types';

export type ArtifactBasedOn =
  Readonly<{ kind: 'session' }> | Readonly<{ kind: 'workflow-run'; workflowRunId: WorkflowRunId }>;

export type ArtifactCreationRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
}>;

type DraftBase = Readonly<{
  brief: string;
  attachments: ReadonlyArray<ArtifactAttachment>;
  mountIds: ReadonlyArray<MountId>;
  basedOn: ArtifactBasedOn;
  routing: ArtifactCreationRouting | null;
  updatedAt: IsoDateTime;
}>;

export type ArtifactReportDraft = DraftBase & Readonly<{ kind: 'report'; reportType: ReportType }>;

export type ArtifactWireframeDraft = DraftBase &
  Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity; target: WireframeTarget }>;

export type ArtifactCreationDraft = ArtifactReportDraft | ArtifactWireframeDraft;

export type SessionArtifactDrafts = Readonly<
  Partial<Record<GeneratedArtifactKind, ArtifactCreationDraft>>
>;

export type SetArtifactDraftParams = Readonly<{
  sessionId: SessionId;
  draft: ArtifactCreationDraft;
}>;

export type ClearArtifactDraftParams = Readonly<{
  sessionId: SessionId;
  kind: GeneratedArtifactKind;
}>;

export type HydrateArtifactDraftsParams = Readonly<{
  sessionId: SessionId;
}>;

export type ArtifactDraftsSlice = Readonly<{
  artifactDrafts: Readonly<Record<SessionId, SessionArtifactDrafts>>;
  setArtifactDraft(params: SetArtifactDraftParams): void;
  clearArtifactDraft(params: ClearArtifactDraftParams): void;
  hydrateArtifactDrafts(params: HydrateArtifactDraftsParams): void;
}>;
