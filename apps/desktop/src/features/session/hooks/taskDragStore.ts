import type { SessionExternalTask, SessionId } from '@goodboy/types';

type TaskDragIntentKind = 'move' | 'copy' | 'refused' | 'same';

export type TaskDragIntent = {
  readonly kind: TaskDragIntentKind;
  readonly text: string;
};

export type TaskDragView = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly x: number;
  readonly y: number;
  readonly isPositioned: boolean;
  readonly targetKey: string | null;
  readonly intent: TaskDragIntent | null;
};

type TaskDragState = {
  readonly view: TaskDragView | null;
  readonly announcement: string;
};

type ViewParams = {
  readonly view: TaskDragView | null;
};

type AnnounceParams = {
  readonly text: string;
};

let state: TaskDragState = { view: null, announcement: '' };
const listeners = new Set<() => void>();

const publish = (next: TaskDragState) => {
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

export const taskDragStore = {
  getState: (): TaskDragState => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setView: ({ view }: ViewParams) => {
    publish({ ...state, view });
  },
  announce: ({ text }: AnnounceParams) => {
    publish({ ...state, announcement: text });
  },
};
