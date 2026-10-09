import { AlertTriangle, GitBranch } from 'lucide-react';
import { AnchoredPopover, PopoverBody, cn, useDropdown } from '@goodboy/ui';
import type { Project, WorkspaceGitStatus } from '@goodboy/types';
import { ProjectGitDetail } from './ProjectGitDetail';
import { projectGitPresentationOf } from '../../../../shared/lib/projectGitPresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly project: Project;
  readonly status: WorkspaceGitStatus | null;
  readonly shouldShowProjectName: boolean;
  readonly isQuiet?: boolean;
};

export const ProjectGitPill = ({
  project,
  status,
  shouldShowProjectName,
  isQuiet = false,
}: Props) => {
  const isSetup = status?.state === 'absent' || status?.state === 'unborn';
  const dropdown = useDropdown({
    width: isSetup ? 'w-96' : 'w-72',
    expectedWidth: isSetup ? 384 : 288,
    expectedHeight: isSetup ? 520 : 260,
    align: 'end',
  });
  const { actionableCount, uncommittedCount, branch, isWarning } = projectGitPresentationOf({
    status,
  });
  const label = shouldShowProjectName ? `${project.name} · ${branch}` : branch;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`${project.name} git status`}
      className={cn('flex max-h-[min(32rem,calc(100vh-2rem))] flex-col', isSetup && 'w-96')}
      trigger={
        <button
          type="button"
          aria-label={`${project.name} git status: ${branch}`}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(
            'relative inline-flex min-w-0 items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            isQuiet
              ? 'h-6 gap-1 px-1 text-meta text-muted-foreground hover:text-foreground'
              : 'h-7 gap-2 px-2 text-label font-medium',
            !isQuiet &&
              (actionableCount > 0 || isWarning
                ? 'text-foreground hover:bg-hover'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground'),
          )}
        >
          <GitBranch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="max-w-36 truncate">{label}</span>
          {isWarning ? (
            <span data-testid="project-git-warning" className="flex items-center text-warning">
              <AlertTriangle size={ICON_SIZE.mark} aria-hidden />
            </span>
          ) : uncommittedCount > 0 ? (
            <span
              data-testid="project-git-count"
              className={cn(
                'shrink-0 text-meta tabular-nums',
                isQuiet ? 'text-muted-foreground' : 'text-warning',
              )}
            >
              {uncommittedCount} uncommitted
            </span>
          ) : null}
        </button>
      }
    >
      <PopoverBody>
        <ProjectGitDetail project={project} status={status} />
      </PopoverBody>
    </AnchoredPopover>
  );
};
