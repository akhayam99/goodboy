import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { useProjectWorktrees } from '../../hooks/useProjectWorktrees';
import { projectWorktreesEventOf } from '../../projectWorktreesEventOf';
import { ProjectWorktreesSheet } from './ProjectWorktreesSheet';
import { worktreesSummaryOf } from './worktreesSummaryOf';

type Props = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly repoRoot: string;
  readonly workspaceId: WorkspaceId;
  readonly hostSessionId: SessionId;
};

export const ProjectWorktrees = ({
  projectId,
  projectName,
  repoRoot,
  workspaceId,
  hostSessionId,
}: Props) => {
  const dropdown = useDropdown({
    width: 'w-[500px] max-w-[calc(100vw-2rem)]',
    expectedHeight: 360,
    expectedWidth: 500,
    openEvent: projectWorktreesEventOf({ sessionId: hostSessionId, projectId }),
  });
  const worktrees = useProjectWorktrees({ repoRoot, isOpen: dropdown.open });
  const summary = worktreesSummaryOf({ worktrees });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="flex"
      role="dialog"
      ariaLabel={`${NAMES.worktrees} in ${projectName}`}
      trigger={
        <Button
          size="sm"
          variant="quiet"
          data-project-worktrees=""
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`${NAMES.worktrees} in ${projectName}: ${summary}`}
          onClick={() => dropdown.toggle()}
        >
          <span className="tabular-nums">{summary}</span>
        </Button>
      }
    >
      <ProjectWorktreesSheet
        worktrees={worktrees}
        projectId={projectId}
        projectName={projectName}
        workspaceId={workspaceId}
        hostSessionId={hostSessionId}
        onClose={dropdown.close}
      />
    </AnchoredPopover>
  );
};
