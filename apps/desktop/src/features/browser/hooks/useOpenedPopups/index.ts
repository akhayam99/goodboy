import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { closeOrphanTab } from '../../closeOrphanTab';
import { listenTabOpened } from '../../listenTabOpened';

type Params = {
  readonly sessionId: SessionId;
};

export const useOpenedPopups = ({ sessionId }: Params): void => {
  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenTabOpened({
      onOpened: ({ facts }) => {
        if (facts.sessionId !== sessionId) {
          return;
        }
        void useAppStore
          .getState()
          .openBrowserTab({ sessionId, tabId: facts.id, url: facts.url, title: facts.title })
          .then((isSaved) => {
            if (!isSaved) {
              return closeOrphanTab({ sessionId, liveId: facts.id });
            }
            useAppStore
              .getState()
              .bindBrowserLiveTab({ sessionId, tabId: facts.id, liveId: facts.id });
            return undefined;
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
