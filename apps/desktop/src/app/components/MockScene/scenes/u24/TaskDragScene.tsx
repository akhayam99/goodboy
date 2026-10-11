import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import type { ProjectId, SessionId } from '@goodboy/types';
import { MountsScene } from '../MountsScene';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

type Props = {
  readonly target: 'session' | 'sibling' | 'other';
  readonly isAlt?: boolean;
};

const POLL_MS = 200;

const START_PX = 24;

const TASK_IDENTIFIER = 'HBL-412';

type Source = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

const sourceOf = (): Source | null => {
  const state = useAppStore.getState();
  for (const mounts of Object.values(state.sessionProjectMounts)) {
    const attached = mounts.filter((mount) => mount.isAttached && mount.branch !== '');
    const first = attached.find(
      (mount) => attached.filter((row) => row.projectId === mount.projectId).length > 1,
    );
    if (first !== undefined) {
      return { sessionId: first.sessionId, projectId: first.projectId, branch: first.branch };
    }
  }
  return null;
};

type AimParams = {
  readonly target: Props['target'];
  readonly source: Source;
};

const aimAt = ({ target, source }: AimParams) => {
  if (target === 'session') {
    return document.querySelector('[data-task-drop="session"]');
  }
  const rows = [...document.querySelectorAll<HTMLElement>('[data-task-drop="branch"]')];
  if (target === 'sibling') {
    return (
      rows.find(
        (row) =>
          row.dataset.taskProject === source.projectId && row.dataset.taskBranch !== source.branch,
      ) ?? null
    );
  }
  return rows.find((row) => row.dataset.taskProject !== source.projectId) ?? null;
};

type CenterParams = {
  readonly element: Element;
};

const centerOf = ({ element }: CenterParams) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

export const TaskDragScene = ({ target, isAlt = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const source = sourceOf();
    if (source === null) {
      return;
    }
    useAppStore.setState((state) => ({
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [source.sessionId]: [
          ...(state.sessionExternalTasks[source.sessionId] ?? []),
          {
            sessionId: source.sessionId,
            projectId: source.projectId,
            provider: 'linear',
            externalId: 'mock-drag-hbl-412',
            identifier: TASK_IDENTIFIER,
            url: 'https://example.invalid/linear/HBL-412',
            title: 'Post each ledger entry once',
            scope: 'branch',
            branch: source.branch,
            relation: 'closes',
            createdAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
          },
        ],
      },
    }));
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    let phase: 'down' | 'aim' | 'done' = 'down';
    const interval = window.setInterval(() => {
      const source = sourceOf();
      if (phase === 'done' || source === null) {
        return;
      }
      if (phase === 'down') {
        const chip = document.querySelector<HTMLElement>(
          `[aria-label="Tasks on ${source.branch}"] button[aria-label^="Open ${TASK_IDENTIFIER}"]`,
        );
        if (chip === null) {
          return;
        }
        const { x, y } = centerOf({ element: chip });
        chip.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }),
        );
        window.dispatchEvent(
          new PointerEvent('pointermove', { clientX: x + START_PX, clientY: y + START_PX }),
        );
        phase = 'aim';
        return;
      }
      const element = aimAt({ target, source });
      if (element === null) {
        return;
      }
      element.setAttribute('data-scene-aim', '');
      const { x, y } = centerOf({ element });
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: x, clientY: y, altKey: isAlt }),
      );
      phase = 'done';
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isAlt, isReady, target]);
  return <MountsScene variant="many-open" />;
};
