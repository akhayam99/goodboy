import { discardSessionDraft } from './discardSessionDraft';
import { openSessionDraft } from './openSessionDraft';
import { patchSessionDraft } from './patchSessionDraft';
import { startBlankSession } from './startBlankSession';
import { startSessionFromDraft } from './startSessionFromDraft';
import type { SliceDeps } from '../../slice-types';

export const createSessionDraftSlice = ({ set, get }: SliceDeps) => {
  return {
    openSessionDraft: openSessionDraft(get),
    patchSessionDraft: patchSessionDraft(set),
    discardSessionDraft: discardSessionDraft(set),
    startSessionFromDraft: startSessionFromDraft(set, get),
    startBlankSession: startBlankSession(set, get),
  };
};
