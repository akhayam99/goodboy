import type { WireframeArtifact } from '@goodboy/types';
import { WIREFRAME_FIDELITY_VARIANT_LABEL } from '../../wireframes/wireframeFidelity';
import { otherWireframeFidelity } from '../../artifacts/artifactActionRuns';

type Params = {
  readonly artifact: WireframeArtifact | null;
};

export const wireframeDescription = ({ artifact }: Params): string | null =>
  artifact === null
    ? null
    : `Runs the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherWireframeFidelity({ artifact })]}, leaving this one untouched`;
