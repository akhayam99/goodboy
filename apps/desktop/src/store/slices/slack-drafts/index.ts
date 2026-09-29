import { decideSessionSlackDraft } from './decideSessionSlackDraft';
import { loadSessionSlackDrafts } from './loadSessionSlackDrafts';
import type { SetFn } from './types';

export const createSlackDraftsSlice = (set: SetFn) => {
  return {
    loadSessionSlackDrafts: loadSessionSlackDrafts(set),
    decideSessionSlackDraft: decideSessionSlackDraft(set),
  };
};
