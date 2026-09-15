import type {
  ArtifactKind,
  PlanArtifactMetadata,
  ReportArtifactMetadata,
  WireframeArtifactMetadata,
} from '@goodboy/types';

export type ArtifactOrigin = 'envelope' | 'legacy';

type ParsedBase<
  Kind extends ArtifactKind,
  Format extends 'markdown' | 'json',
  Metadata,
> = Readonly<{
  kind: Kind;
  schemaVersion: number;
  title: string;
  sourceFormat: Format;
  sourceText: string;
  metadata: Metadata;
  origin: ArtifactOrigin;
}>;

export type ParsedPlanArtifact = ParsedBase<'plan', 'markdown', PlanArtifactMetadata>;

export type ParsedReportArtifact = ParsedBase<'report', 'markdown', ReportArtifactMetadata>;

export type ParsedWireframeArtifact = ParsedBase<'wireframe', 'json', WireframeArtifactMetadata>;

export type ParsedArtifact = ParsedPlanArtifact | ParsedReportArtifact | ParsedWireframeArtifact;

export type ArtifactCaptureErrorCode =
  | 'truncated'
  | 'multiple_blocks'
  | 'too_large'
  | 'unsupported_version'
  | 'unknown_kind'
  | 'invalid_json'
  | 'invalid_format'
  | 'invalid_payload';

export type ArtifactCaptureError = Readonly<{
  status: 'error';
  code: ArtifactCaptureErrorCode;
  message: string;
}>;

export type ArtifactCaptureResult =
  | Readonly<{ status: 'none' }>
  | Readonly<{ status: 'captured'; artifact: ParsedArtifact }>
  | ArtifactCaptureError;
