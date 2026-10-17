import { FolderGit2 } from 'lucide-react';
import { Button, IconButton } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useRunningHere } from '../../../../store';
import { linkedProjectsLabel } from '../../linkedProjectsLabel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WorkspaceTile } from './WorkspaceTile';

type Props = {
  readonly workspace: Workspace;
  readonly onLinkRepo: () => void;
  readonly onManageProjects: () => void;
  readonly onOpenSettings: () => void;
};

type ActiveParams = {
  readonly active: number;
};

const activeLabel = ({ active }: ActiveParams): string => {
  if (active === 0) {
    return 'nothing active';
  }
  return active === 1 ? '1 session active' : `${active} sessions active`;
};

export const CurrentWorkspaceRow = ({
  workspace,
  onLinkRepo,
  onManageProjects,
  onOpenSettings,
}: Props) => {
  const projectsLabel = useAppStore((state) =>
    linkedProjectsLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const running = useRunningHere();

  return (
    <section
      aria-label={`Current workspace: ${workspace.name}`}
      data-workspace-current=""
      className="flex flex-col gap-2 rounded-md bg-muted p-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <WorkspaceTile workspace={workspace} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-row text-foreground">{workspace.name}</span>
          <span className="truncate text-meta text-muted-foreground">
            {projectsLabel} · {activeLabel({ active: running })}
          </span>
        </span>
        <IconButton
          icon={CONCEPT_ICONS.settings}
          label="Workspace settings"
          variant="ghost"
          size="xs"
          iconSize={ICON_SIZE.row}
          onClick={onOpenSettings}
        />
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <Button size="xs" variant="secondary" onClick={onLinkRepo}>
          <FolderGit2 size={ICON_SIZE.row} aria-hidden />
          Link a repository
        </Button>
        <Button size="xs" variant="ghost" onClick={onManageProjects}>
          Manage projects
        </Button>
      </div>
    </section>
  );
};
