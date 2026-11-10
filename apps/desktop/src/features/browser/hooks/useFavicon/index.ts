import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import { originOf } from '../../originOf';

type Params = {
  readonly liveId: string | undefined;
  readonly url: string;
};

export const useFavicon = ({ liveId, url }: Params): void => {
  const origin = originOf({ url });
  const isKnown = useAppStore(
    (state) => origin === null || state.browserFavicons[origin] !== undefined,
  );

  useEffect(() => {
    if (liveId === undefined || origin === null || isKnown) {
      return undefined;
    }
    const key = `favicon:${liveId}`;
    const claimed = browserPaneRequests.favicons.claim({ key });
    void browserHost.favicon({ tabId: liveId }).then(
      (found) => {
        if (claimed.isCurrent() && found !== null) {
          useAppStore.getState().setBrowserFavicon({ origin: found.origin, src: found.src });
        }
      },
      () => undefined,
    );
    return () => browserPaneRequests.favicons.cancel({ key });
  }, [liveId, origin, isKnown]);
};
