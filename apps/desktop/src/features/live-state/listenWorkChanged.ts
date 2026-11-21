import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';

const WORK_CHANGED_EVENT = 'work-changed';

export type WorkChanged = Readonly<{
  sessionId: string;
  mountId: string | null;
}>;

type ChangeParams = {
  readonly change: WorkChanged;
};

type Params = {
  readonly onChange: (params: ChangeParams) => void;
};

type ValueParams = {
  readonly value: unknown;
};

const workChangedOf = ({ value }: ValueParams): WorkChanged | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const sessionId: unknown = Reflect.get(value, 'sessionId');
  const mountId: unknown = Reflect.get(value, 'mountId');
  if (typeof sessionId !== 'string') {
    return null;
  }
  return { sessionId, mountId: typeof mountId === 'string' ? mountId : null };
};

export const listenWorkChanged = async ({ onChange }: Params): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<unknown>(WORK_CHANGED_EVENT, (event) => {
    const change = workChangedOf({ value: event.payload });
    if (change !== null) {
      onChange({ change });
    }
  });
};
