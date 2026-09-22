import type { ProviderId } from '@goodboy/types';
import { extractClusterGraphFromMarker, extractPlanFromMarker } from '../context';
import { ARTIFACT_SCHEMA_VERSION } from './grammar';
import { parseArtifactEnvelope } from './parseArtifactEnvelope';
import type { ArtifactCaptureResult } from './types';

export type LegacyArtifactParams = {
  readonly assistantText: string;
  readonly emittingProvider: ProviderId | null;
};

export const parseLegacyPlanMarkers = ({
  assistantText,
  emittingProvider,
}: LegacyArtifactParams): ArtifactCaptureResult => {
  const extracted = extractPlanFromMarker(assistantText);
  if (extracted === null) {
    return { status: 'none' };
  }
  const clusters = extractClusterGraphFromMarker({ assistantText, emittingProvider });
  if (clusters.kind === 'invalid') {
    return {
      status: 'error',
      code: 'invalid_payload',
      message: `the plan clusters are not a valid graph: ${clusters.reason}`,
    };
  }
  return {
    status: 'captured',
    artifact: {
      kind: 'plan',
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      title: extracted.title,
      sourceFormat: 'markdown',
      sourceText: extracted.bodyMd,
      metadata: clusters.kind === 'valid' ? { clusters: clusters.clusters } : {},
      origin: 'legacy',
    },
  };
};

export const captureArtifactFromTurnText = ({
  assistantText,
  emittingProvider,
}: LegacyArtifactParams): ArtifactCaptureResult => {
  const envelope = parseArtifactEnvelope(assistantText);
  if (envelope.status !== 'none') {
    return envelope;
  }
  return parseLegacyPlanMarkers({ assistantText, emittingProvider });
};
