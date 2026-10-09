import { setAskDraft } from './setAskDraft';
import type { AskDraftParams, SetFn } from './types';

export const clearAskDraft =
  (set: SetFn) =>
  ({ sessionId, threadId }: AskDraftParams): void => {
    setAskDraft(set)({ sessionId, threadId, text: '' });
  };
