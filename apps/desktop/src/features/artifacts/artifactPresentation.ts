import type { ArtifactKind } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';

type Concept = keyof typeof CONCEPT_ICONS;

export const ARTIFACT_KIND_CONCEPT: Record<ArtifactKind, Concept> = {
  plan: 'plans',
  report: 'sessionSummary',
  wireframe: 'workflowPreset',
};

export const ARTIFACT_KIND_MARKER_LABEL: Record<ArtifactKind, string> = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
};
