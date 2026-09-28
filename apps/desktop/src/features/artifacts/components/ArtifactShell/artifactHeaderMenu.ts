import { createContext } from 'react';
import type { ActionViewing, ArtifactActionTarget } from '../../../actions/types';

export type ArtifactHeaderMenuRegister = (target: ArtifactActionTarget | null) => void;

export const ArtifactHeaderMenuContext = createContext<ArtifactHeaderMenuRegister | null>(null);

export const ARTIFACT_HEADER_ANCHOR = 'artifact-header';

export const artifactViewingOf = ({
  target,
}: {
  readonly target: ArtifactActionTarget;
}): ActionViewing | null =>
  target.subject.kind === 'stored' ? { kind: 'artifact', id: target.subject.artifactId } : null;
