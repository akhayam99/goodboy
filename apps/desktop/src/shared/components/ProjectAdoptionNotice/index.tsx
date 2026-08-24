import { FolderGit2 } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';

type Props = {
  readonly conflict: ProjectAttachConflict;
  readonly busy: boolean;
  readonly onMove: (conflict: ProjectAttachConflict) => void;
  readonly onKeep: (conflict: ProjectAttachConflict) => void;
};

export const ProjectAdoptionNotice = ({ conflict, busy, onMove, onKeep }: Props) => {
  const { project, sourceWorkspace, sessionCount } = conflict;
  const sessionsLabel = sessionCount === 1 ? '1 session' : `${sessionCount} sessions`;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-left"
    >
      <FolderGit2 size={16} aria-hidden className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{project.name}</span>
        <span className="block text-xs text-muted-foreground">
          already in {sourceWorkspace.name} with {sessionsLabel}
        </span>
      </span>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={busy}
        onClick={() => onMove(conflict)}
      >
        Move it here
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => onKeep(conflict)}
      >
        Keep there
      </Button>
    </div>
  );
};
