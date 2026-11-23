import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isRecord } from '@goodboy/types/helpers';
import type { SessionId } from '@goodboy/types';
import { invokeCommand } from '../../../../../shared/lib/invokeCommand';
import { isTauriRuntime } from '../../../../../shared/lib/isTauriRuntime';

export const DESK_HOLDER_EVENT = 'desk-holder';

export type DeskHold = {
  readonly sessionId: string;
  readonly holder: string | null;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type HoldParams = SessionParams & {
  readonly isTaken: boolean;
};

export type OnHoldParams = {
  readonly hold: DeskHold;
};

type ListenParams = {
  readonly onHold: (params: OnHoldParams) => void;
};

type ValueParams = {
  readonly value: unknown;
};

const holdOf = ({ value }: ValueParams): DeskHold | null => {
  if (!isRecord(value) || typeof value.sessionId !== 'string') {
    return null;
  }
  if (value.holder !== null && typeof value.holder !== 'string') {
    return null;
  }
  return { sessionId: value.sessionId, holder: value.holder };
};

const NO_LISTENER: UnlistenFn = () => undefined;

export const deskHolder = {
  hold: async ({ sessionId, isTaken }: HoldParams): Promise<DeskHold | null> => {
    if (!isTauriRuntime()) {
      return null;
    }
    return holdOf({ value: await invokeCommand<unknown>('desk_hold', { sessionId, isTaken }) });
  },
  read: async ({ sessionId }: SessionParams): Promise<DeskHold | null> => {
    if (!isTauriRuntime()) {
      return null;
    }
    try {
      return holdOf({ value: await invokeCommand<unknown>('desk_holder', { sessionId }) });
    } catch {
      return null;
    }
  },
  release: async ({ sessionId }: SessionParams): Promise<boolean> => {
    if (!isTauriRuntime()) {
      return false;
    }
    try {
      await invokeCommand<unknown>('desk_release', { sessionId });
      return true;
    } catch {
      return false;
    }
  },
  listen: async ({ onHold }: ListenParams): Promise<UnlistenFn> => {
    if (!isTauriRuntime()) {
      return NO_LISTENER;
    }
    try {
      return await listen<unknown>(DESK_HOLDER_EVENT, (event) => {
        const hold = holdOf({ value: event.payload });
        if (hold !== null) {
          onHold({ hold });
        }
      });
    } catch {
      return NO_LISTENER;
    }
  },
};
