import { chipClasses, cn } from '@goodboy/ui';
import { useSyncExternalStore } from 'react';
import { taskDragStore } from '../../hooks/taskDragStore';
import { useTaskDragState } from '../../hooks/useTaskDragState';

const GHOST_OFFSET_PX = 14;

export const TaskDragLayer = () => {
  const drag = useTaskDragState();
  const announcement = useSyncExternalStore(
    taskDragStore.subscribe,
    () => taskDragStore.getState().announcement,
    () => '',
  );
  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {drag === null || !drag.isPositioned ? null : (
        <div
          data-testid="task-drag-ghost"
          aria-hidden
          style={{ left: drag.x + GHOST_OFFSET_PX, top: drag.y + GHOST_OFFSET_PX }}
          className="pointer-events-none fixed z-50 flex items-center gap-2"
        >
          <span
            className={cn(
              'shadow-md',
              chipClasses({ tone: 'neutral', shape: 'badge', size: 'control' }),
            )}
          >
            {drag.task.identifier}
          </span>
          {drag.intent === null ? null : (
            <span
              className={cn(
                'text-label',
                chipClasses({
                  tone: drag.intent.kind === 'refused' ? 'danger' : 'neutral',
                  shape: 'pill',
                  size: 'control',
                }),
              )}
            >
              {drag.intent.text}
            </span>
          )}
        </div>
      )}
    </>
  );
};
