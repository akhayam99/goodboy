import { reportCreationAdapter } from '../reports/reportCreationAdapter';
import { wireframeCreationAdapter } from '../wireframes/wireframeCreationAdapter';
import type { GeneratedArtifactKind } from './artifactCollection';
import type { ArtifactCreationAdapter } from './artifactCreationAdapter';

export const ARTIFACT_CREATION_ADAPTERS: Readonly<
  Record<GeneratedArtifactKind, ArtifactCreationAdapter>
> = {
  report: reportCreationAdapter,
  wireframe: wireframeCreationAdapter,
};
