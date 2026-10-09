import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { branchPlace } from '../../store/slices/navigation/place';
import { selectOpenDrawer } from '../../store/slices/drawer/selectOpenDrawer';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { noteIdOfThread } from '../resolve/notes/noteThread';
import { reviewNotesDrawer } from '../resolve/notes/notesDrawer';

export const REVIEW_REQUEST_EVENT = 'goodboy:review-request';

export type ReviewComposeMode = 'edit' | 'redraft' | 'answer' | 'reply' | 'fixAnyway' | 'rewrite';

type ReviewRequest =
  | { readonly kind: 'compose'; readonly threadId: string; readonly mode: ReviewComposeMode }
  | { readonly kind: 'edit_reply'; readonly threadId: string }
  | { readonly kind: 'model'; readonly threadId: string }
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

type FixParams = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

const isNoteThreadId = (threadId: string): boolean => noteIdOfThread({ threadId }) !== null;

const openNotes = ({
  getState,
  sessionId,
  threadId,
}: {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string | null;
}): void => {
  const state = getState();
  const open = selectOpenDrawer(state);
  if (open !== null && open.sessionId === sessionId && open.kind === 'review-notes') {
    return;
  }
  const mountPath = state.diffMountPath?.[sessionId] ?? null;
  state.navigate({
    to: branchPlace({ sessionId, mountPath, tab: 'files' }),
    drawer: reviewNotesDrawer({ sessionId, mountPath, focusThreadId: threadId }),
  });
};

const requestFix = ({ getState, sessionId, threadIds }: FixParams): void => {
  const state = getState();
  state.requestReviewLaunch({ sessionId, threadIds });
  if (threadIds.length > 0 && threadIds.every(isNoteThreadId)) {
    openNotes({ getState, sessionId, threadId: threadIds[0] ?? null });
    return;
  }
  const isOnComments =
    state.currentSessionId === sessionId &&
    (state.activeLens[sessionId] ?? null) === 'branch' &&
    (state.branchTab[sessionId] ?? 'comments') === 'comments';
  if (isOnComments) {
    return;
  }
  state.navigate({
    to: branchPlace({
      sessionId,
      tab: 'comments',
      threadId: state.branchThreadId[sessionId] ?? null,
    }),
  });
};

export const requestReview = ({ getState, sessionId, request }: Params): void => {
  if (request.kind === 'fix') {
    requestFix({ getState, sessionId, threadIds: request.threadIds });
    return;
  }
  if (dispatch({ sessionId, request })) {
    return;
  }
  const threadId = 'threadId' in request ? request.threadId : null;
  if (threadId !== null && isNoteThreadId(threadId)) {
    openNotes({ getState, sessionId, threadId });
    dispatchAfterNavigation({ name: REVIEW_REQUEST_EVENT, detail: { sessionId, request } });
    return;
  }
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
