import type { SessionId } from '@goodboy/types';
import { CommandError } from '../../shared/lib/invokeCommand';
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

type MissingParams = {
  readonly error: unknown;
};

const MISSING_MESSAGE = /not found|no such file|not a file/i;

const isMissing = ({ error }: MissingParams): boolean =>
  error instanceof CommandError &&
  (error.kind === 'not_file' || (error.kind === 'io' && MISSING_MESSAGE.test(error.message)));

export const openFileLink = async ({ sessionId, root, baseDir, link }: Params): Promise<void> => {
  const relPath = fileLinkRelPath({ root, baseDir, path: link.path });
  if (relPath === null) {
    throw new Error(`${link.path} is outside this folder.`);
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
    if (isMissing({ error })) {
      throw new Error(`${link.path} is missing. It may have been moved or deleted.`, {
        cause: error,
      });
    }
    throw error;
  }
};
