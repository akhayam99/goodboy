import { buildWireframeJsonSchema, type WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { artifactFolderName } from '../../artifacts/artifactFolderName';
import { asWireframeFidelity } from '../wireframeFidelity';
import {
  renderWireframeIndexPage,
  renderWireframeScreenPage,
  WIREFRAME_CSS_FILE,
} from './renderWireframePages';
import { wireframeExportCss } from './wireframeExportCss';
import { WIREFRAME_JSON_FILE, WIREFRAME_SCHEMA_FILE, wireframeReadme } from './wireframeReadme';
import { WIREFRAME_SCREENS_DIR, wireframeScreenFile } from './wireframeScreenFile';

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

export const buildWireframeExport = ({
  artifact,
  document,
  appVersion,
}: Params): WireframeExport => {
  const title = artifact.title;
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const json = { $schema: `./${WIREFRAME_SCHEMA_FILE}`, ...document };
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
  const screens = document.screens.map((screen) => ({
    path: `${WIREFRAME_SCREENS_DIR}/${wireframeScreenFile({ screenId: screen.id })}`,
    contents: renderWireframeScreenPage({ document, screen, title }),
  }));
  return {
    folder: artifactFolderName({ artifact }),
    files: [
      { path: 'index.html', contents: renderWireframeIndexPage({ document, title }) },
      ...screens,
      {
        path: WIREFRAME_CSS_FILE,
        contents: wireframeExportCss({ theme: document.theme, fidelity }),
      },
      { path: WIREFRAME_JSON_FILE, contents: `${JSON.stringify(json, null, 2)}\n` },
      {
        path: WIREFRAME_SCHEMA_FILE,
        contents: `${JSON.stringify(buildWireframeJsonSchema(), null, 2)}\n`,
      },
      { path: 'README.md', contents: wireframeReadme({ title, document }) },
      { path: 'meta.json', contents: `${JSON.stringify(meta, null, 2)}\n` },
    ],
  };
};
