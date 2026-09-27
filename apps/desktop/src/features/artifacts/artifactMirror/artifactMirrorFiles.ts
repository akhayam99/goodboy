import type { SessionArtifact } from '@goodboy/types';
import type { ArtifactFolderFile } from '../artifactFile';
import { artifactFolderName } from '../artifactFolderName';
import { buildWireframeMirror } from '../../wireframes/wireframePages/buildWireframeMirror';
import type { WireframeVersion } from '../../wireframes/wireframeVersion';
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
  readonly versions?: ReadonlyArray<WireframeVersion>;
};

const metaFile = ({ artifact, workspaceSlug, appVersion }: Params): ArtifactFolderFile => ({
  path: 'meta.json',
  contents: `${JSON.stringify(artifactMirrorMeta({ artifact, workspaceSlug, appVersion }), null, 2)}\n`,
});

export const artifactMirrorFiles = ({
  artifact,
  workspaceSlug,
  appVersion,
  versions = [],
}: Params): ArtifactMirrorFiles => {
  const folder = artifactFolderName({ artifact });
  if (artifact.kind === 'wireframe') {
    return {
      folder,
      files: [
        ...buildWireframeMirror({ artifact, versions, workspaceName: workspaceSlug }),
        metaFile({ artifact, workspaceSlug, appVersion }),
      ],
    };
  }
  return {
    folder,
    files: [
      {
        path: 'index.html',
        contents: renderArtifactFile({ artifact, workspaceName: workspaceSlug }),
      },
      { path: ARTIFACT_DOCUMENT_CSS_FILE, contents: artifactDocumentCss() },
      { path: 'source.md', contents: `${artifact.sourceText}\n` },
      metaFile({ artifact, workspaceSlug, appVersion }),
    ],
  };
};
