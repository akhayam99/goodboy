import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { branchPlace } from '../../store/slices/navigation/place';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';

export const REVIEW_REQUEST_EVENT = 'goodboy:review-request';

export type ReviewComposeMode = 'edit' | 'redraft' | 'answer' | 'reply';

type ReviewRequest =
  | { readonly kind: 'compose'; readonly threadId: string; readonly mode: ReviewComposeMode }
  | { readonly kind: 'edit_reply'; readonly threadId: string }
  | { readonly kind: 'fix'; readonly threadIds: ReadonlyArray<string> }
  | { readonly kind: 'push' };

export type ReviewRequestDetail = {
  readonly sessionId: SessionId;
  readonly request: ReviewRequest;
};

const dispatch = (detail: ReviewRequestDetail): boolean => {
  const event = new CustomEvent<ReviewRequestDetail>(REVIEW_REQUEST_EVENT, {
    detail,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

type Params = ReviewRequestDetail & {
  readonly getState: () => AppStore;
};

export const requestReview = ({ getState, sessionId, request }: Params): void => {
  if (dispatch({ sessionId, request })) {
    return;
  }
  const threadId = 'threadId' in request ? request.threadId : null;
  getState().navigate({
    to: branchPlace({ sessionId, tab: 'comments', threadId }),
    drawer: threadId === null ? null : { kind: 'conversation', sessionId, payload: { threadId } },
  });
  dispatchAfterNavigation({ name: REVIEW_REQUEST_EVENT, detail: { sessionId, request } });
};

export const isReviewRequest = (event: Event): event is CustomEvent<ReviewRequestDetail> =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'request' in event.detail;
