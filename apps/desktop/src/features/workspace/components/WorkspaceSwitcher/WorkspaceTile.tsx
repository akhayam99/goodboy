import type { Workspace } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { workspaceAccent } from '../../color';

type Props = {
  readonly workspace: Workspace;
  readonly isDimmed?: boolean;
};

const initialOf = ({ name }: Pick<Workspace, 'name'>): string =>
  name.trim().charAt(0).toUpperCase() || '?';

export const WorkspaceTile = ({ workspace, isDimmed = false }: Props) => (
  <span
    aria-hidden
    data-workspace-tile=""
    className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-md text-chip text-on-tone ring-1 ring-inset ring-border-soft',
      isDimmed && 'opacity-60',
    )}
    style={{ backgroundColor: workspaceAccent(workspace.id) }}
  >
    {initialOf({ name: workspace.name })}
  </span>
);
