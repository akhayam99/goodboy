import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectProjectById } from '../../../../store/slices/projects/selectProjectById';
import { usePointerDrag } from '../../../../shared/hooks/usePointerDrag';
import { taskDragIntent } from '../taskDragIntent';
import { taskDragStore } from '../taskDragStore';
import { readTaskDropTarget, taskDropTargetKey } from '../taskDropTargetKey';

type Params = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string | null;
};

type Payload = {
  readonly origin: HTMLElement;
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string | null;
};

type PointParams = {
  readonly payload: Payload;
  readonly x: number;
  readonly y: number;
  readonly isAlt: boolean;
};

const nameOf = (projectId: ProjectId | null | undefined): string | null =>
  projectId == null ? null : (selectProjectById(useAppStore.getState(), projectId)?.name ?? null);

const resolve = ({ payload, x, y, isAlt }: PointParams) => {
  const to = readTaskDropTarget({
    element: document.elementFromPoint(x, y),
    projectIds: useAppStore.getState().projects.map((project) => project.id),
  });
  return {
    to,
    intent: taskDragIntent({
      task: payload.task,
      sourceBranch: payload.branch,
      to,
      isCopy: isAlt,
      nameOf,
    }),
  };
};

let releaseSwallow: (() => void) | null = null;

const clearSwallow = () => {
  releaseSwallow?.();
  releaseSwallow = null;
};

type SwallowParams = {
  readonly origin: HTMLElement;
};

const swallowNextClick = ({ origin }: SwallowParams) => {
  clearSwallow();
  const swallow = (event: MouseEvent) => {
    const isOnOrigin = event.target instanceof Node && origin.contains(event.target);
    clearSwallow();
    if (!isOnOrigin) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true });
  releaseSwallow = () => {
    window.removeEventListener('click', swallow, { capture: true });
  };
};

export const useTaskDrag = ({ sessionId, task, branch }: Params) => {
  const engine = usePointerDrag<Payload>({
    canStartOnControls: true,
    onStart: ({ payload }) => {
      taskDragStore.setView({
        view: {
          sessionId: payload.sessionId,
          task: payload.task,
          x: 0,
          y: 0,
          isPositioned: false,
          targetKey: null,
          intent: null,
        },
      });
      taskDragStore.announce({ text: `Dragging ${payload.task.identifier}` });
    },
    onMove: ({ payload, x, y, isAlt }) => {
      const { to, intent } = resolve({ payload, x, y, isAlt });
      const previous = taskDragStore.getState().view;
      taskDragStore.setView({
        view: {
          sessionId: payload.sessionId,
          task: payload.task,
          x,
          y,
          isPositioned: true,
          targetKey: to === null ? null : taskDropTargetKey({ to }),
          intent,
        },
      });
      if (previous?.intent?.text !== intent?.text && intent !== null) {
        taskDragStore.announce({ text: `${payload.task.identifier}: ${intent.text}` });
      }
    },
    onRelease: ({ payload, x, y, isAlt }) => {
      swallowNextClick({ origin: payload.origin });
      const { to, intent } = resolve({ payload, x, y, isAlt });
      taskDragStore.setView({ view: null });
      if (to === null || intent === null || (intent.kind !== 'move' && intent.kind !== 'copy')) {
        taskDragStore.announce({
          text:
            intent !== null && intent.kind === 'refused'
              ? `${payload.task.identifier}: ${intent.text}`
              : `${payload.task.identifier}: drag cancelled`,
        });
        return;
      }
      const state = useAppStore.getState();
      void state
        .moveSessionExternalTask({
          sessionId: payload.sessionId,
          task: payload.task,
          to,
          isCopy: intent.kind === 'copy',
        })
        .then(() =>
          taskDragStore.announce({
            text: `${payload.task.identifier}: ${intent.text.replace(/^Move to/, 'Moved to').replace(/^Copy to/, 'Copied to')}`,
          }),
        )
        .catch(async (error: unknown) => {
          taskDragStore.announce({ text: `Couldn't move ${payload.task.identifier}` });
          await state.reportError({
            title: `Couldn't move ${payload.task.identifier}`,
            error,
            sessionId: payload.sessionId,
          });
        });
    },
    onCancel: ({ payload }) => {
      swallowNextClick({ origin: payload.origin });
      taskDragStore.setView({ view: null });
      taskDragStore.announce({ text: `${payload.task.identifier}: drag cancelled` });
    },
  });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-slot="unlink-slot"]') !== null
      ) {
        return;
      }
      clearSwallow();
      engine.onPointerDown({
        event,
        payload: { origin: event.currentTarget, sessionId, task, branch },
      });
    },
    [branch, engine, sessionId, task],
  );

  return { onPointerDown };
};
