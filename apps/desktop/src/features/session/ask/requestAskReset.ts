import type { SessionId } from '@goodboy/types';
import { ASK_RESET_EVENT } from './ASK_RESET_EVENT';

type Params = {
  readonly sessionId: SessionId;
};

export const requestAskReset = ({ sessionId }: Params): void => {
  window.dispatchEvent(new CustomEvent<SessionId>(ASK_RESET_EVENT, { detail: sessionId }));
};
