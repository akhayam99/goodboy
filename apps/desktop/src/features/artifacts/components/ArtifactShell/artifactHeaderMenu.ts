import { createContext } from 'react';
import type { ArtifactActionTarget } from '../../../actions/types';

export type ArtifactHeaderMenuRegister = (target: ArtifactActionTarget | null) => void;

export const ArtifactHeaderMenuContext = createContext<ArtifactHeaderMenuRegister | null>(null);

export const ARTIFACT_HEADER_ANCHOR = 'artifact-header';
