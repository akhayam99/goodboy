import type { SessionId } from '@goodboy/types';

export const SESSION_SPEND_LIMIT_EDIT_EVENT = 'goodboy:edit-session-spend-limit';

type Params = {
  readonly sessionId: SessionId;
};

export const requestSessionSpendLimitEdit = ({ sessionId }: Params): void => {
  window.dispatchEvent(new CustomEvent(SESSION_SPEND_LIMIT_EDIT_EVENT, { detail: { sessionId } }));
};
