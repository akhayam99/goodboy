import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import type { ArtifactFolderFile } from '../artifacts/artifactFile';
import { buildWireframeExport } from './wireframePages/buildWireframeExport';

const STAGED = ['.html', '.css'] as const;

type Params = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
};

export const wireframeStageFiles = ({
  artifact,
  document,
}: Params): ReadonlyArray<ArtifactFolderFile> =>
  buildWireframeExport({ artifact, document, appVersion: null }).files.filter((file) =>
    STAGED.some((extension) => file.path.endsWith(extension)),
  );
