import { useCallback, useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button, DrawerFrame, ErrorStrip, formatError, ICON_SIZE, Skeleton } from '@goodboy/ui';
import type { FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { FileDiffSource } from '../../../../store/slices/drawer/state';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ghCommitDiff } from '../../../integrations/github/github';
import { worktreeDiff, worktreeDiffCommit, worktreeFileSides } from '../../../worktree/worktree';
import { useSessionDiff } from '../../hooks/useSessionDiff';
import { splitPath } from '../../lib/fileStatus';
import { DiffView } from '../DiffView';

type Props = {
  readonly sessionId: SessionId;
  readonly source: FileDiffSource;
  readonly path: string | null;
  readonly onClose: () => void;
};

const matches = (filePath: string, path: string): boolean =>
  filePath === path || path.endsWith(`/${filePath}`) || filePath.endsWith(`/${path}`);

export const FileDiffDrawer = ({ sessionId, source, path, onClose }: Props) => {
  const sessionWorktree = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId })?.worktreePath ?? null,
  );
  const worktreeBase = useAppStore((state) =>
    source.kind === 'worktree'
      ? selectMountBaseBranch({ state, sessionId, path: source.worktreePath })
      : null,
  );
  const editorBinary = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const reportError = useAppStore((state) => state.reportError);
  const editorRoot = source.kind === 'worktree' ? source.worktreePath : sessionWorktree;
  const fileActions = useMemo(
    () =>
      editorRoot === null
        ? null
        : {
            onOpenInEditor: (filePath: string) => {
              void openFileInWorkspace({
                workspacePath: editorRoot,
                filePath: `${editorRoot}/${filePath}`,
                editor: editorBinary,
              }).catch((error: unknown) =>
                reportError({
                  title: "Couldn't open the file in your editor",
                  error: formatError(error),
                  sessionId,
                }),
              );
            },
          },
    [editorBinary, editorRoot, reportError, sessionId],
  );
  const openMountDiff = useAppStore((state) => state.openMountDiff);
  const setDiffFocus = useAppStore((state) => state.setDiffFocus);

  const loader = useCallback(async (): Promise<string> => {
    if (source.kind === 'worktree') {
      return worktreeDiff({ worktreePath: source.worktreePath, baseBranch: worktreeBase });
    }
    if (sessionWorktree !== null) {
      try {
        return await worktreeDiffCommit(sessionWorktree, source.sha);
      } catch (error) {
        if (source.repo === '') {
          throw error;
        }
      }
    }
    return ghCommitDiff(source.repo, source.sha);
  }, [sessionWorktree, source, worktreeBase]);

  const diff = useSessionDiff({ sessionId: null, worktreePath: null, loader });
  const files = useMemo(
    () => (path === null ? diff.files : diff.files.filter((file) => matches(file.path, path))),
    [diff.files, path],
  );

  const loadFileSides = useCallback(
    (file: FileDiff) =>
      worktreeFileSides({
        worktreePath: source.kind === 'worktree' ? source.worktreePath : (sessionWorktree ?? ''),
        path: file.path,
        oldRev: source.kind === 'commit' ? `${source.sha}^` : null,
        newRev: source.kind === 'commit' ? source.sha : null,
        baseBranch: worktreeBase,
      }),
    [sessionWorktree, source, worktreeBase],
  );

  const title =
    path !== null
      ? splitPath(path).name
      : source.kind === 'commit'
        ? `Commit ${source.sha.slice(0, 7)}`
        : 'Changes';

  const openInDiff =
    source.kind === 'worktree'
      ? () => {
          openMountDiff(sessionId, source.worktreePath);
          setDiffFocus(sessionId, { kind: 'branch', path });
        }
      : null;

  return (
    <DrawerFrame
      title={title}
      icon={CONCEPT_ICONS.diff}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll="self"
      action={
        openInDiff === null ? null : (
          <Button variant="ghost" size="sm" onClick={openInDiff}>
            Open in Files
            <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
          </Button>
        )
      }
    >
      {diff.loading ? (
        <div role="status" className="flex flex-col gap-2 p-3" aria-label="Loading diff">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
          <Skeleton className="h-3 w-1/2 rounded-sm" />
        </div>
      ) : diff.error !== null ? (
        <div className="p-3">
          <ErrorStrip label="the diff" error={new Error(diff.error)} onRetry={diff.refresh} />
        </div>
      ) : files.length === 0 ? (
        <p className="p-4 text-body text-muted-foreground">
          {path === null ? 'No changes in this commit.' : 'This file has no changes here.'}
        </p>
      ) : (
        <DiffView
          files={files}
          presentation="peek"
          fileActions={fileActions}
          loadFileSides={
            source.kind === 'commit' && sessionWorktree === null ? null : loadFileSides
          }
        />
      )}
    </DrawerFrame>
  );
};
