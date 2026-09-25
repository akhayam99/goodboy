import type {
  PlanArtifact,
  PlanWithCount,
  ReportArtifact,
  WireframeArtifact,
} from '@goodboy/types';
import type { ArtifactGeneration } from '../../artifactCollection';

export type ArtifactDocumentSubject =
  | Readonly<{ kind: 'plan'; plan: PlanWithCount; artifact: PlanArtifact }>
  | Readonly<{ kind: 'report'; artifact: ReportArtifact }>
  | Readonly<{ kind: 'wireframe'; artifact: WireframeArtifact }>;

export type ArtifactShellSubject =
  ArtifactDocumentSubject | Readonly<{ kind: 'generation'; generation: ArtifactGeneration }>;
