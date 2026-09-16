import type { AgentId, IsoDateTime, SessionId, WorkflowRunId } from './ids';
import type { WorkflowRoutingProposal } from './workflow-routing';

export type ArtifactId = string & { readonly __brand: 'ArtifactId' };

export type ArtifactKind = 'plan' | 'report' | 'wireframe';

export type ArtifactStatus = 'active' | 'consumed' | 'superseded' | 'discarded';

export type ArtifactSourceFormat = 'markdown' | 'json';

export type ImplementationCluster = Readonly<{
  title: string;
  instructions: string;
  routingProposal?: WorkflowRoutingProposal | null;
}>;

export type PlanArtifactMetadata = Readonly<{
  clusters?: ReadonlyArray<ImplementationCluster>;
}>;

export type ReportArtifactMetadata = Readonly<{
  reportType: string;
}>;

export type WireframeArtifactMetadata = Readonly<{
  fidelity: 'low' | 'high';
  designProfile: Readonly<Record<string, unknown>>;
}>;

type SessionArtifactBase<
  Kind extends ArtifactKind,
  SourceFormat extends ArtifactSourceFormat,
  Metadata,
> = Readonly<{
  id: ArtifactId;
  sessionId: SessionId;
  agentId: AgentId;
  workflowRunId: WorkflowRunId | null;
  kind: Kind;
  schemaVersion: number;
  title: string;
  sourceFormat: SourceFormat;
  sourceText: string;
  metadata: Metadata;
  status: ArtifactStatus;
  revision: number;
  sourceTurnId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PlanArtifact = SessionArtifactBase<'plan', 'markdown', PlanArtifactMetadata>;

export type ReportArtifact = SessionArtifactBase<'report', 'markdown', ReportArtifactMetadata>;

export type WireframeArtifact = SessionArtifactBase<'wireframe', 'json', WireframeArtifactMetadata>;

export type SessionArtifact = PlanArtifact | ReportArtifact | WireframeArtifact;

export type ArtifactEvidenceKind = 'session' | 'agent' | 'artifact' | 'workflow-run' | 'unknown';

export type ArtifactEvidenceSource = Readonly<{
  kind: ArtifactEvidenceKind;
  id: string;
  label: string;
}>;

export type ArtifactProvenance = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  kind: ArtifactKind;
  brief: string | null;
  evidence: ReadonlyArray<ArtifactEvidenceSource>;
  omissions: ReadonlyArray<string>;
  designProfileSummary: string | null;
  sourceWorkflowRunId: WorkflowRunId | null;
  executingWorkflowRunId: WorkflowRunId | null;
  createdAt: IsoDateTime;
}>;

export type ArtifactRendition = Readonly<{
  artifactId: ArtifactId;
  revision: number;
  format: string;
  rendererVersion: string;
  bytes: Uint8Array;
  createdAt: IsoDateTime;
}>;
