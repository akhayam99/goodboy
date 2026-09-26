import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import type { ArtifactFolderFile } from '../artifacts/artifactFile';
import { asWireframeFidelity } from './wireframeFidelity';
import { buildWireframeVersionFiles } from './wireframePages/buildWireframeVersionFiles';
import type { WireframeDiffMarks } from './wireframePages/renderWireframeNode';

const STAGED = ['.html', '.css'] as const;

type Params = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly marks?: ReadonlyMap<string, WireframeDiffMarks>;
};

export const wireframeStageFiles = ({
  artifact,
  document,
  marks,
}: Params): ReadonlyArray<ArtifactFolderFile> =>
  buildWireframeVersionFiles({
    document,
    sourceText: artifact.sourceText,
    title: artifact.title,
    fidelity: asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low',
    schemaHref: './wireframe.schema.json',
    ...(marks === undefined ? {} : { marks }),
  }).filter((file) => STAGED.some((extension) => file.path.endsWith(extension)));
