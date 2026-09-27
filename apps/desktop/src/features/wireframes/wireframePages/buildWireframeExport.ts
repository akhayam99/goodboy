import { buildWireframeJsonSchema, type WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { artifactFolderName } from '../../artifacts/artifactFolderName';
import { asWireframeFidelity } from '../wireframeFidelity';
import { buildWireframeVersionFiles } from './buildWireframeVersionFiles';
import { WIREFRAME_SCHEMA_FILE, wireframeReadme } from './wireframeReadme';

export type WireframeExportFile = Readonly<{ path: string; contents: string }>;

export type WireframeExport = Readonly<{
  folder: string;
  files: ReadonlyArray<WireframeExportFile>;
}>;

type Params = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly appVersion: string | null;
};

export const wireframeSchemaFile = (): WireframeExportFile => ({
  path: WIREFRAME_SCHEMA_FILE,
  contents: `${JSON.stringify(buildWireframeJsonSchema(), null, 2)}\n`,
});

export const buildWireframeExport = ({
  artifact,
  document,
  appVersion,
}: Params): WireframeExport => {
  const title = artifact.title;
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const meta = {
    id: artifact.id,
    kind: artifact.kind,
    title,
    revision: artifact.revision,
    session: artifact.sessionId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    appVersion,
  };
  return {
    folder: artifactFolderName({ artifact }),
    files: [
      ...buildWireframeVersionFiles({
        document,
        sourceText: artifact.sourceText,
        title,
        fidelity,
        schemaHref: `./${WIREFRAME_SCHEMA_FILE}`,
      }),
      wireframeSchemaFile(),
      { path: 'README.md', contents: wireframeReadme({ title, document, hasVersions: false }) },
      { path: 'meta.json', contents: `${JSON.stringify(meta, null, 2)}\n` },
    ],
  };
};
