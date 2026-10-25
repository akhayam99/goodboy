import type { SessionId } from '@goodboy/types';
import { resolveEditorBinary } from '../../shared/lib/editorSettings';
import { useAppStore } from '../../store';
import { exploreOpen } from './explore';
import { fileLinkRelPath } from './fileLinkRelPath';
import { resolveExploreEditor } from './resolveExploreEditor';

type Params = {
  readonly sessionId: SessionId | null;
  readonly root: string;
  readonly baseDir: string;
  readonly link: {
    readonly path: string;
    readonly line: number | null;
    readonly column: number | null;
  };
};

export const openFileLink = async ({ sessionId, root, baseDir, link }: Params): Promise<void> => {
  const { reportError } = useAppStore.getState();
  const relPath = fileLinkRelPath({ root, baseDir, path: link.path });
  if (relPath === null) {
    void reportError({
      title: "Couldn't open the file",
      error: new Error(`${link.path} is outside this folder.`),
      severity: 'warning',
    });
    return;
  }
  if (useAppStore.getState().detectedEditors.length === 0) {
    await useAppStore.getState().loadDetectedEditors();
  }
  const state = useAppStore.getState();
  const editor = resolveExploreEditor({
    configured: resolveEditorBinary({ settings: state.settings }),
    detected: state.detectedEditors,
  });
  const line = link.line ?? undefined;
  const column = link.column ?? undefined;
  if (editor === null && sessionId !== null) {
    const name = relPath.split('/').pop() ?? relPath;
    state.openDrawer({
      kind: 'explore-file',
      sessionId,
      payload: {
        sessionDir: root,
        entry: { name, relPath, isDir: false, sizeBytes: null, modifiedAt: null },
        ...(line === undefined ? {} : { line }),
      },
    });
    return;
  }
  try {
    await exploreOpen({
      sessionDir: root,
      relPath,
      reveal: false,
      editor: editor?.binary ?? null,
      ...(line === undefined ? {} : { line }),
      ...(column === undefined ? {} : { column }),
    });
  } catch (error) {
    void reportError({ title: "Couldn't open the file", error });
  }
};
