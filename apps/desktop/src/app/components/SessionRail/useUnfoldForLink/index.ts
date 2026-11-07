import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { linkIssueEventName } from '../../../../features/actions/kinds/session';
import { dispatchAfterNavigation } from '../../../../features/actions/dispatchAfterNavigation';
import type { SessionRailFold } from '../useSessionRailFold';

type Params = {
  readonly sessionId: SessionId;
  readonly fold: SessionRailFold;
};

export const useUnfoldForLink = ({ sessionId, fold }: Params): void => {
  const isPendingRef = useRef(false);
  const { isFolded, toggle } = fold;

  useEffect(() => {
    if (!isFolded) {
      isPendingRef.current = false;
      return;
    }
    const name = linkIssueEventName({ sessionId });
    const controller = new AbortController();
    window.addEventListener(
      name,
      (event) => {
        if (isPendingRef.current) {
          return;
        }
        isPendingRef.current = true;
        toggle();
        dispatchAfterNavigation({
          name,
          detail: event instanceof CustomEvent ? event.detail : undefined,
        });
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [isFolded, sessionId, toggle]);
};
