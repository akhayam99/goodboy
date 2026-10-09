import { useCallback } from 'react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NAMES } from '../../../shared/names';
import { runObjectAction } from '../registry';
import { useActionEnv } from '../useActionEnv';

type Params = {
  readonly session: Session;
};

export type SessionPin = {
  readonly isPinned: boolean;
  readonly label: typeof NAMES.pin | typeof NAMES.unpin;
  readonly toggle: () => void;
};

export const useSessionPin = ({ session }: Params): SessionPin => {
  const sessionId = session.id as SessionId;
  const workspaceId = session.workspaceId as WorkspaceId;
  const isPinned = useAppStore((state) =>
    (state.sessionPins[workspaceId] ?? []).some((pin) => pin.id === sessionId),
  );
  const env = useActionEnv({ origin: 'button' });
  const toggle = useCallback(() => {
    void runObjectAction({
      target: { kind: 'session', sessionId },
      actionId: isPinned ? 'session.unpin' : 'session.pin',
      env,
    });
  }, [env, isPinned, sessionId]);
  return { isPinned, label: isPinned ? NAMES.unpin : NAMES.pin, toggle };
};
