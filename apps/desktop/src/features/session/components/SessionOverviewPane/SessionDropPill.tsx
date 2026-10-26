import { chipClasses, cn } from '@goodboy/ui';
import { useTaskDragState } from '../../hooks/useTaskDragState';
import { useTaskDropState } from '../../hooks/useTaskDropState';

export const SessionDropPill = () => {
  const drag = useTaskDragState();
  const dropState = useTaskDropState({ target: 'session' });
  if (drag === null) {
    return null;
  }
  return (
    <span
      data-task-drop="session"
      aria-label="Drop to put on the session"
      className={cn(
        'shrink-0 rounded-md text-meta',
        chipClasses({ tone: 'neutral', kind: 'reference' }),
        dropState === 'over' && 'bg-selected',
      )}
    >
      Session
    </span>
  );
};
