import { Star } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
};

export const ProjectStarToggle = ({ project, busy }: Props) => {
  const setProjectStarred = useAppStore((state) => state.setProjectStarred);
  const reportError = useAppStore((state) => state.reportError);
  const isStarred = project.starredAt !== undefined;

  const toggle = async () => {
    try {
      await setProjectStarred({ projectId: project.id, isStarred: !isStarred });
    } catch (error) {
      void reportError({ title: `Couldn't update ${project.name}`, error });
    }
  };

  return (
    <Tooltip content="Starred projects come first for agents" anchorClassName="shrink-0">
      <button
        type="button"
        aria-label={`Starred: ${project.name}`}
        aria-pressed={isStarred}
        disabled={busy}
        onClick={() => void toggle()}
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-md hover:bg-hover disabled:opacity-50',
          isStarred ? 'text-warning' : 'text-faint-foreground hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <Star size={ICON_SIZE.row} aria-hidden className={isStarred ? 'fill-current' : undefined} />
      </button>
    </Tooltip>
  );
};
