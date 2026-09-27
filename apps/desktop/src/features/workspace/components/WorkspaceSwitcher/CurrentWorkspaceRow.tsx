import { Check } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useRunningHere } from '../../../../store';
import { linkedProjectsLabel } from '../../linkedProjectsLabel';
import { workspaceAccent } from '../../color';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspace: Workspace;
  readonly onOpenSettings: () => void;
};

const runningLabel = (running: number): string => {
  if (running === 0) {
    return 'nothing running';
  }
  return running === 1 ? '1 running' : `${running} running`;
};

export const CurrentWorkspaceRow = ({ workspace, onOpenSettings }: Props) => {
  const projectsLabel = useAppStore((state) =>
    linkedProjectsLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const running = useRunningHere();
  const accent = workspaceAccent(workspace.id);

  return (
    <div className="flex w-full items-center gap-3 rounded-md bg-muted px-3 py-2">
      <span
        aria-hidden
        className="h-7 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="min-w-0 flex-1">
        <span className="truncate text-row text-foreground">{workspace.name}</span>
        <span className="block truncate text-label text-muted-foreground">
          {projectsLabel} · {runningLabel(running)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-label text-muted-foreground">
        <Check size={ICON_SIZE.row} aria-hidden />
        Current
      </span>
      <IconButton
        icon={CONCEPT_ICONS.settings}
        label="Workspace settings"
        variant="ghost"
        onClick={onOpenSettings}
      />
    </div>
  );
};
