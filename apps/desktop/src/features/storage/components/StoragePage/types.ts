import type { ArtifactId } from '@goodboy/types';

export type ToggleFolderParams = {
  readonly path: string;
  readonly isOn: boolean;
};

export type ToggleFolder = (params: ToggleFolderParams) => void;

export type ToggleArtifactParams = {
  readonly id: ArtifactId;
  readonly isOn: boolean;
};

export type ToggleArtifact = (params: ToggleArtifactParams) => void;
