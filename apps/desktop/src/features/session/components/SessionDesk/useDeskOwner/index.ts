import { useEffect, useSyncExternalStore } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ActionRetry } from '../../../../../store/slices/notifications/actionRetries';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { switchSessionFace } from '../switchSessionFace';
import { applyDeskHold } from './applyDeskHold';
import { deskHolder, type OnHoldParams } from './deskHolder';
import { deskLines, type DeskLine } from './deskLines';

type Params = {
  readonly sessionId: SessionId;
  readonly isDeskShown: boolean;
};

const HOLDER_POLL_MS = 5_000;

const onHoldChange = ({ hold }: OnHoldParams): void => applyDeskHold({ hold, line: 'moved' });

const retryDesk =
  ({ sessionId }: Pick<Params, 'sessionId'>): ActionRetry =>
  async () => {
    switchSessionFace({ sessionId, face: 'desk' });
    return useAppStore.getState().sessionFace[sessionId] === 'desk';
  };

export const useDeskOwner = ({ sessionId, isDeskShown }: Params): DeskLine | null => {
  const line = useSyncExternalStore(
    (onChange) => deskLines.subscribe({ listener: onChange }),
    () => deskLines.lineOf({ sessionId }),
  );

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | null = null;
    void deskHolder.listen({ onHold: onHoldChange }).then((stop) => {
      if (isActive) {
        unlisten = stop;
        return;
      }
      stop();
    });
    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isDeskShown) {
      return;
    }
    let isActive = true;
    void deskHolder.hold({ sessionId, isTaken: false }).then(
      (hold) => {
        if (isActive && hold !== null) {
          applyDeskHold({ hold, line: 'open-elsewhere' });
        }
      },
      (error: unknown) => {
        if (!isActive) {
          return;
        }
        const state = useAppStore.getState();
        if (state.sessionFace[sessionId] === 'desk') {
          state.setSessionFace({ sessionId, face: 'overview' });
        }
        void state.reportError({
          title: "Couldn't check which window holds the Desk",
          error,
          sessionId,
          recovery: NOTHING_CHANGED,
          retry: retryDesk({ sessionId }),
        });
      },
    );
    return () => {
      isActive = false;
      void deskHolder.release({ sessionId });
    };
  }, [isDeskShown, sessionId]);

  usePoll({
    run: () => {
      void deskHolder.read({ sessionId }).then((hold) => {
        if (hold !== null && hold.sessionId === sessionId) {
          applyDeskHold({ hold, line: 'moved' });
        }
      });
    },
    everyMs: HOLDER_POLL_MS,
    isEnabled: line === 'open-elsewhere' || line === 'moved',
    isImmediate: false,
    restartKey: sessionId,
  });

  return line;
};
