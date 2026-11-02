import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DrawerFrame, EmptyLine, ErrorStrip, Skeleton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { IdentifierPeekSelection } from '../../../../store/slices/drawer/state';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { worktreeDiff } from '../../../worktree/worktree';
import { useIdentifierUses } from '../../hooks/useIdentifierUses';
import { useSessionDiff } from '../../hooks/useSessionDiff';
import { PeekFileDiff } from './PeekFileDiff';
import { PeekFileList } from './PeekFileList';
import { peekFiles } from './peekFiles';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly word: string;
  readonly selected: IdentifierPeekSelection;
  readonly renderSource: (params: PeekSourceParams) => ReactNode;
  readonly onClose: () => void;
};

export type PeekSourceParams = {
  readonly worktreePath: string;
  readonly path: string;
  readonly line: number;
};

const NO_PATHS: ReadonlySet<string> = new Set();

export const IdentifierPeekDrawer = ({
  sessionId,
  worktreePath,
  word,
  selected: requested,
  renderSource,
  onClose,
}: Props) => {
  const [selected, setSelected] = useState(requested);
  const [seen, setSeen] = useState(requested);
  if (seen.path !== requested.path || seen.line !== requested.line) {
    setSeen(requested);
    setSelected(requested);
  }
  const baseBranch = useAppStore((state) =>
    selectMountBaseBranch({ state, sessionId, path: worktreePath }),
  );
  const uses = useIdentifierUses({ worktreePath, word });
  const loader = useCallback(
    () => worktreeDiff({ worktreePath, baseBranch }),
    [baseBranch, worktreePath],
  );
  const diff = useSessionDiff({ sessionId: null, worktreePath: null, loader });
  const changedPaths = useMemo(
    () => (diff.loading ? NO_PATHS : new Set(diff.files.map((file) => file.path))),
    [diff.files, diff.loading],
  );
  const groups = useMemo(
    () => (uses.status === 'ready' ? peekFiles({ matches: uses.matches, word, changedPaths }) : []),
    [changedPaths, uses, word],
  );
  const file = diff.files.find((candidate) => candidate.path === selected.path) ?? null;

  const renderBody = () => {
    if (diff.error !== null) {
      return (
        <div className="p-3">
          <ErrorStrip label="the changes" error={new Error(diff.error)} onRetry={diff.refresh} />
        </div>
      );
    }
    if (diff.loading) {
      return (
        <div role="status" className="flex flex-col gap-2 p-3" aria-label="Loading file">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
          <Skeleton className="h-3 w-1/2 rounded-sm" />
        </div>
      );
    }
    if (file === null) {
      return renderSource({ worktreePath, path: selected.path, line: selected.line });
    }
    return (
      <PeekFileDiff
        worktreePath={worktreePath}
        baseBranch={baseBranch}
        file={file}
        line={selected.line}
      />
    );
  };

  return (
    <DrawerFrame
      title={word}
      icon={CONCEPT_ICONS.diff}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll="self"
      toolbar={
        <div className="flex min-w-0 flex-col">
          {uses.status === 'searching' ? (
            <div role="status" aria-label="Searching" className="flex flex-col gap-2 p-3">
              <Skeleton className="h-3 w-1/2 rounded-sm" />
              <Skeleton className="h-3 w-2/3 rounded-sm" />
            </div>
          ) : null}
          {uses.status === 'error' ? (
            <div className="p-3">
              <ErrorStrip label="the search" error={new Error(uses.message)} onRetry={uses.retry} />
            </div>
          ) : null}
          {uses.status === 'ready' && groups.length === 0 ? (
            <EmptyLine>No uses found</EmptyLine>
          ) : null}
          {groups.length > 0 ? (
            <PeekFileList
              groups={groups}
              selectedPath={selected.path}
              onSelect={(target) => setSelected({ path: target.path, line: target.line })}
            />
          ) : null}
        </div>
      }
    >
      {renderBody()}
    </DrawerFrame>
  );
};
