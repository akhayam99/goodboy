import type { WireframeArtifact } from '@goodboy/types';
import { mirrorArtifacts } from '../artifacts/artifactMirror/artifactMirrorQueue';
import { openSavedCopy } from '../open/openSavedCopy';
import { screenPagePath, WIREFRAME_INDEX_PAGE } from './wireframePagePath';

type Params = {
  readonly artifact: WireframeArtifact;
  readonly workspaceSlug: string;
  readonly screenId: string | null;
};

const wireframeBrowserFile = ({ screenId }: { readonly screenId: string | null }): string =>
  screenId === null ? WIREFRAME_INDEX_PAGE : screenPagePath({ screenId, state: null });

export const openWireframeInBrowser = async ({
  artifact,
  workspaceSlug,
  screenId,
}: Params): Promise<void> => {
  await mirrorArtifacts({ items: [{ artifact, workspaceSlug }] });
  await openSavedCopy({ artifact, workspaceSlug, file: wireframeBrowserFile({ screenId }) });
};
