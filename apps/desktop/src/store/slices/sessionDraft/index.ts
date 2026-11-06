import { closeSessionDraft } from './closeSessionDraft';
import { discardSessionDraft } from './discardSessionDraft';
import { hydrateSessionDraft } from './hydrateSessionDraft';
import { openSessionDraft } from './openSessionDraft';
import { patchSessionDraft } from './patchSessionDraft';
import { startBlankSession } from './startBlankSession';
import { startSessionFromDraft } from './startSessionFromDraft';
import type { SliceDeps } from '../../slice-types';

export const createSessionDraftSlice = ({ set, get }: SliceDeps) => {
  return {
    openSessionDraft: openSessionDraft(get),
    patchSessionDraft: patchSessionDraft(set, get),
    closeSessionDraft: closeSessionDraft(get),
    discardSessionDraft: discardSessionDraft(set, get),
    hydrateSessionDraft: hydrateSessionDraft({ set, get }),
    startSessionFromDraft: startSessionFromDraft(set, get),
    startBlankSession: startBlankSession(set, get),
  };
};
