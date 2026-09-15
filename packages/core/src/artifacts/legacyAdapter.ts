import type { ProviderId } from '@goodboy/types';
import { extractClustersFromMarker, extractPlanFromMarker } from '../context';
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
  const clusters = extractClustersFromMarker({ assistantText, emittingProvider });
  return {
    status: 'captured',
    artifact: {
      kind: 'plan',
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      title: extracted.title,
      sourceFormat: 'markdown',
      sourceText: extracted.bodyMd,
      metadata: clusters !== null && clusters.length > 0 ? { clusters } : {},
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
