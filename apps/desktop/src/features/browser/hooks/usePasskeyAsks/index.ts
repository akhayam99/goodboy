import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { listenPasskeyAsk } from '../../listenPasskeyAsk';

type Params = {
  readonly sessionId: SessionId;
};

export const usePasskeyAsks = ({ sessionId }: Params): void => {
  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenPasskeyAsk({
      onAsk: ({ ask }) => {
        if (ask.sessionId !== sessionId) {
          return;
        }
        useAppStore.getState().noteBrowserPasskeyAsk({
          sessionId,
          liveId: ask.tabId,
          host: ask.host,
          isAsked: ask.isAsked,
        });
      },
    }).then((stop) => {
      if (!isLive) {
        stop();
        return;
      }
      unlisten = stop;
    });
    return () => {
      isLive = false;
      unlisten?.();
    };
  }, [sessionId]);
};
