import { Suspense } from 'react';
import { AnchoredPopover, Button, SkeletonRows, useDropdown } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { lazyNamed } from '../../../../shared/lib/lazyNamed';
import { NAMES } from '../../../../shared/utils/names';
import { useProjectWorktrees } from '../../hooks/useProjectWorktrees';
import { projectWorktreesEventOf } from '../../projectWorktreesEventOf';
import { worktreesSummaryOf } from './worktreesSummaryOf';

const ProjectWorktreesSheet = lazyNamed({
  load: () => import('./ProjectWorktreesSheet'),
  pick: ({ ProjectWorktreesSheet }) => ProjectWorktreesSheet,
});

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
      <Suspense fallback={<SkeletonRows label="Loading worktrees" />}>
        <ProjectWorktreesSheet
          worktrees={worktrees}
          projectName={projectName}
          workspaceId={workspaceId}
          hostSessionId={hostSessionId}
          onClose={dropdown.close}
        />
      </Suspense>
    </AnchoredPopover>
  );
};
