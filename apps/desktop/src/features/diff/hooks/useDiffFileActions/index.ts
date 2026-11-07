import { useCallback, useMemo } from 'react';
import type { DiffView, FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { worktreeFileSides } from '../../../worktree/worktree';
import { useOpenDiffFileInEditor } from '../useOpenDiffFileInEditor';

type Params = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly view: DiffView;
  readonly baseBranch: string | null;
};

type FileActions = {
  readonly onShowWhole: (file: FileDiff) => void;
  readonly onOpenInEditor?: (path: string) => void;
};

type DiffFileActions = {
  readonly fileActions: FileActions;
  readonly loadFileSides: (file: FileDiff) => ReturnType<typeof worktreeFileSides>;
};

export const useDiffFileActions = ({
  sessionId,
  workingDir,
  worktreePath,
  view,
  baseBranch,
}: Params): DiffFileActions => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const openInEditor = useOpenDiffFileInEditor({ sessionId, workingDir });
  const revs = useMemo(() => {
    const oldRev =
      view.kind === 'commit'
        ? `${view.sha}^`
        : view.kind === 'working'
          ? view.scope === 'unstaged'
            ? ':0'
            : 'HEAD'
          : null;
    const newRev =
      view.kind === 'commit'
        ? view.sha
        : view.kind === 'working' && view.scope === 'staged'
          ? ':0'
          : null;
    return { oldRev, newRev };
  }, [view]);
  const loadFileSides = useCallback(
    (file: FileDiff) =>
      worktreeFileSides({
        worktreePath,
        path: file.path,
        oldRev: revs.oldRev,
        newRev: revs.newRev,
        baseBranch,
      }),
    [baseBranch, revs, worktreePath],
  );
  const showWhole = useCallback(
    (file: FileDiff) =>
      openDrawer({
        kind: 'file-diff',
        sessionId,
        payload: {
          source: { kind: 'worktree', worktreePath },
          path: file.path,
          whole: { file, oldRev: revs.oldRev, newRev: revs.newRev, baseBranch },
        },
      }),
    [baseBranch, openDrawer, revs, sessionId, worktreePath],
  );
  const openPath = useCallback((path: string) => void openInEditor(path), [openInEditor]);
  const fileActions = useMemo(
    () => ({
      onShowWhole: showWhole,
      ...(workingDir !== null && { onOpenInEditor: openPath }),
    }),
    [openPath, showWhole, workingDir],
  );
  return { fileActions, loadFileSides };
};
