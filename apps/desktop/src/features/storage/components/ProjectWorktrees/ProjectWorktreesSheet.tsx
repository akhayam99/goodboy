import { useRef, useState } from 'react';
import { GitFork } from '@goodboy/ui/icons';
import { Button, EmptyLine, ICON_SIZE, PopoverPin } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { ProjectWorktreesView } from '../../hooks/useProjectWorktrees';
import { openStorage } from '../../openStorage';
import { StorageOutcomeNotice } from '../StoragePage/StorageOutcomeNotice';
import { NewBranchInSession } from './NewBranchInSession';
import { ProjectWorktreeRow } from './ProjectWorktreeRow';
import { RemoveSafeWorktrees } from './RemoveSafeWorktrees';
import { worktreesSummaryOf } from './worktreesSummaryOf';

type Props = {
  readonly worktrees: ProjectWorktreesView;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly workspaceId: WorkspaceId;
  readonly hostSessionId: SessionId;
  readonly onClose: () => void;
};

export const ProjectWorktreesSheet = ({
  worktrees,
  projectId,
  projectName,
  workspaceId,
  hostSessionId,
  onClose,
}: Props) => {
  const outcome = useAppStore((state) => state.storageOutcome);
  const openedOutcome = useRef(outcome);
  const [isCreating, setIsCreating] = useState(false);
  const now = Date.now();
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex min-w-0 items-baseline gap-2 px-2">
        <span className="min-w-0 truncate text-control text-foreground">{`${NAMES.worktrees} in ${projectName}`}</span>
        {worktrees.count > 0 ? (
          <span className="shrink-0 text-meta text-muted-foreground">
            {worktreesSummaryOf({ worktrees })}
          </span>
        ) : null}
      </div>
      {worktrees.count === 0 ? (
        <EmptyLine className="px-2">No worktree of this project is on disk.</EmptyLine>
      ) : (
        <div
          role="list"
          aria-label={`${NAMES.worktrees} in ${projectName}`}
          className="flex flex-col"
        >
          {worktrees.tracks.map((track) => (
            <div role="listitem" key={track.folder.path}>
              <ProjectWorktreeRow
                track={track}
                hostSessionId={hostSessionId}
                now={now}
                isMeasuring={worktrees.measuringPath === track.folder.path}
                onLeave={onClose}
              />
            </div>
          ))}
        </div>
      )}
      {outcome !== null && outcome !== openedOutcome.current ? <StorageOutcomeNotice /> : null}
      <PopoverPin edge="end" className="flex flex-col gap-2 p-2">
        {isCreating ? (
          <NewBranchInSession
            projectId={projectId}
            projectName={projectName}
            workspaceId={workspaceId}
            hostSessionId={hostSessionId}
            onClose={() => setIsCreating(false)}
          />
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsCreating(true)}>
              <GitFork size={ICON_SIZE.row} aria-hidden />
              {NAMES.newBranch}
            </Button>
            <span className="min-w-0 flex-1" />
            <RemoveSafeWorktrees safe={worktrees.safe} safeBytes={worktrees.safeBytes} />
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                onClose();
                openStorage({ scope: { kind: 'workspace', id: workspaceId } });
              }}
            >
              {NAMES.cleanUpInStorage}
            </Button>
          </div>
        )}
      </PopoverPin>
    </div>
  );
};
