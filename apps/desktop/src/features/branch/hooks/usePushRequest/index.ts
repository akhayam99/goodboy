import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';

type PressParams = {
  readonly isRetry: boolean;
};

type PushPort = {
  readonly press: (params: PressParams) => Promise<void>;
};

type Params = {
  readonly sessionId: SessionId;
  readonly push: PushPort;
  readonly hasPushFailure: boolean;
};

export const usePushRequest = ({ sessionId, push, hasPushFailure }: Params): void => {
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      REVIEW_REQUEST_EVENT,
      (event) => {
        if (!isReviewRequest(event) || event.defaultPrevented) {
          return;
        }
        if (event.detail.sessionId !== sessionId || event.detail.request.kind !== 'push') {
          return;
        }
        event.preventDefault();
        void push.press({ isRetry: hasPushFailure });
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [hasPushFailure, push, sessionId]);
};
