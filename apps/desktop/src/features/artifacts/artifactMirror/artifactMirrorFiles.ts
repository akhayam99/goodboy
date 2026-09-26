import { parseWireframeSource } from '@goodboy/core';
import type { SessionArtifact } from '@goodboy/types';
import type { ArtifactFolderFile } from '../artifactFile';
import { artifactFolderName } from '../artifactFolderName';
import { buildWireframeExport } from '../../wireframes/wireframeExport/buildWireframeExport';
import { artifactMirrorMeta } from './artifactMirrorMeta';
import {
  ARTIFACT_DOCUMENT_CSS_FILE,
  artifactDocumentCss,
  renderArtifactFile,
} from './renderArtifactFile';

export type ArtifactMirrorFiles = Readonly<{
  folder: string;
  files: ReadonlyArray<ArtifactFolderFile>;
}>;

type Params = {
  readonly artifact: SessionArtifact;
  readonly workspaceSlug: string;
  readonly appVersion: string | null;
};

const metaFile = ({ artifact, workspaceSlug, appVersion }: Params): ArtifactFolderFile => ({
  path: 'meta.json',
  contents: `${JSON.stringify(artifactMirrorMeta({ artifact, workspaceSlug, appVersion }), null, 2)}\n`,
});

export const artifactMirrorFiles = ({
  artifact,
  workspaceSlug,
  appVersion,
}: Params): ArtifactMirrorFiles => {
  const folder = artifactFolderName({ artifact });
  if (artifact.kind === 'wireframe') {
    const parsed = parseWireframeSource({ source: artifact.sourceText });
    if (parsed.status !== 'valid') {
      return {
        folder,
        files: [
          { path: 'wireframe.json', contents: artifact.sourceText },
          metaFile({ artifact, workspaceSlug, appVersion }),
        ],
      };
    }
    const built = buildWireframeExport({ artifact, document: parsed.document, appVersion });
    return {
      folder,
      files: [
        ...built.files.filter((file) => file.path !== 'meta.json'),
        metaFile({ artifact, workspaceSlug, appVersion }),
      ],
    };
  }
  return {
    folder,
    files: [
      { path: 'index.html', contents: renderArtifactFile({ artifact }) },
      { path: ARTIFACT_DOCUMENT_CSS_FILE, contents: artifactDocumentCss() },
      { path: 'source.md', contents: `${artifact.sourceText}\n` },
      metaFile({ artifact, workspaceSlug, appVersion }),
    ],
  };
};
