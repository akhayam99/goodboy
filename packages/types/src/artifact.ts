import type { AgentId, IsoDateTime, MountId, SessionId, WorkflowRunId } from './ids';
import type { AgentRole } from './workflow';
import type { WorkflowRoutingProposal } from './workflow-routing';

export type ArtifactId = string & { readonly __brand: 'ArtifactId' };

export type ArtifactKind = 'plan' | 'report' | 'wireframe';

export type ArtifactStatus = 'active' | 'consumed' | 'superseded' | 'discarded';

export type ArtifactSourceFormat = 'markdown' | 'json';

export type PlanClusterRole = Extract<
  AgentRole,
  'scout' | 'implementer' | 'reviewer' | 'tester' | 'investigator' | 'docs'
>;

export const PLAN_CLUSTER_ROLES = [
  'scout',
  'implementer',
  'reviewer',
  'tester',
  'investigator',
  'docs',
] as const satisfies ReadonlyArray<PlanClusterRole>;

export type ImplementationCluster = Readonly<{
  id?: string;
  title: string;
  instructions: string;
  role?: PlanClusterRole;
  dependsOn?: ReadonlyArray<string>;
  expectedOutput?: string;
  routingProposal?: WorkflowRoutingProposal | null;
}>;

export const CLUSTER_EXECUTION_VERSION_LEGACY = 1;

export const CLUSTER_EXECUTION_VERSION_GRAPH = 2;

export type ClusterGraphNode = Readonly<{
  id: string;
  ordinal: number;
  title: string;
  instructions: string;
  role: PlanClusterRole;
  dependsOn: ReadonlyArray<string>;
  expectedOutput: string | null;
}>;

export type ClusterGraph = Readonly<{
  executionVersion: number;
  nodes: ReadonlyArray<ClusterGraphNode>;
}>;

export type ClusterExecutionNode = Readonly<{
  nodeId: string;
  agentId: AgentId | null;
  ordinal: number;
  role: PlanClusterRole;
}>;

export type ClusterExecutionGraph = Readonly<{
  containerAgentId: AgentId;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  planId: string | null;
  goalTitle: string;
  graph: ClusterGraph;
  nodes: ReadonlyArray<ClusterExecutionNode>;
  createdAt: IsoDateTime;
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

export type ArtifactRunPhase = 'gathering' | 'producing' | 'done' | 'failed';

export type ArtifactRunTarget = 'mobile' | 'desktop' | 'both';

export type ArtifactScoutPlanEntry = Readonly<{
  roleId: string;
  mountId: MountId;
  root: string;
  reason: string;
  agentId: AgentId | null;
}>;

export type ArtifactProvenance = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  kind: ArtifactKind;
  brief: string | null;
  evidence: ReadonlyArray<ArtifactEvidenceSource>;
  omissions: ReadonlyArray<string>;
  designProfileSummary: string | null;
  hasDesignEvidence: boolean;
  phase: ArtifactRunPhase;
  scoutPlan: ReadonlyArray<ArtifactScoutPlanEntry>;
  mountIds: ReadonlyArray<MountId>;
  target: ArtifactRunTarget | null;
  deadlineAt: number | null;
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
