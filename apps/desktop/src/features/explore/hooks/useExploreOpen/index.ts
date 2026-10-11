import { useCallback, useEffect, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { exploreOpen, type ExploreEntry } from '../../explore';
import { fileKindOf } from '../../fileKindOf';
import { openActionOf, type ExploreOpenAction } from '../../openAction';
import { openFailureOf, type ExploreOpenFailure } from '../../openFailure';
import { resolveExploreEditor } from '../../resolveExploreEditor';

type Params = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
};

type EntryParams = {
  readonly entry: ExploreEntry;
};

type RunParams = EntryParams & {
  readonly isReveal: boolean;
};

export type ExploreOpen = {
  readonly actionOf: (params: EntryParams) => ExploreOpenAction;
  readonly canOpen: (params: EntryParams) => boolean;
  readonly run: (params: RunParams) => Promise<ExploreOpenFailure | null>;
};

export const useExploreOpen = ({ sessionId, sessionDir }: Params): ExploreOpen => {
  const projectKind = useAppStore((state): 'repo' | 'folder' => {
    const mount = selectActiveMount({ state, sessionId });
    if (mount === null) {
      return 'folder';
    }
    return projectById(state.projects, mount.projectId)?.kind ?? 'repo';
  });
  const hasGit = useAppStore((state) => {
    const mount = selectActiveMount({ state, sessionId });
    return mount !== null && mount.branch.trim() !== '';
  });
  const configured = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const detected = useAppStore((state) => state.detectedEditors);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const editor = useMemo(
    () => resolveExploreEditor({ configured, detected }),
    [configured, detected],
  );

  useEffect(() => {
    if (detected.length === 0) {
      void loadDetectedEditors();
    }
  }, [detected.length, loadDetectedEditors]);

  const actionOf = useCallback(
    ({ entry }: EntryParams): ExploreOpenAction =>
      openActionOf({
        projectKind,
        hasGit,
        fileKind: entry.isDir ? 'text' : fileKindOf({ name: entry.name }),
        editor,
      }),
    [editor, hasGit, projectKind],
  );

  const canOpen = useCallback(
    ({ entry }: EntryParams): boolean => !entry.isDir || actionOf({ entry }).editor !== null,
    [actionOf],
  );

  const run = useCallback(
    async ({ entry, isReveal }: RunParams): Promise<ExploreOpenFailure | null> => {
      if (sessionDir === null || sessionDir.trim() === '') {
        return null;
      }
      const action = actionOf({ entry });
      try {
        await exploreOpen({
          sessionDir,
          relPath: entry.relPath,
          reveal: isReveal,
          editor: isReveal ? null : (action.editor?.binary ?? null),
        });
        return null;
      } catch (error) {
        return openFailureOf({ name: entry.name, action, isReveal, error });
      }
    },
    [actionOf, sessionDir],
  );

  return useMemo(() => ({ actionOf, canOpen, run }), [actionOf, canOpen, run]);
};
