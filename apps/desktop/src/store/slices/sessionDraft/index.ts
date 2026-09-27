import { discardSessionDraft } from './discardSessionDraft';
import { openSessionDraft } from './openSessionDraft';
import { patchSessionDraft } from './patchSessionDraft';
import { startBlankSession } from './startBlankSession';
import { startSessionFromDraft } from './startSessionFromDraft';
import type { GetFn, SetFn } from './types';

export const createSessionDraftSlice = (set: SetFn, get: GetFn) => {
  return {
    openSessionDraft: openSessionDraft(get),
    patchSessionDraft: patchSessionDraft(set),
    discardSessionDraft: discardSessionDraft(set),
    startSessionFromDraft: startSessionFromDraft(set, get),
    startBlankSession: startBlankSession(set, get),
  };
};
