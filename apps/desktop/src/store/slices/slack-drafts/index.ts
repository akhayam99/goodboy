import { decideSessionSlackDraft } from './decideSessionSlackDraft';
import { loadSessionSlackDrafts } from './loadSessionSlackDrafts';
import type { SliceDeps } from '../../slice-types';

export const createSlackDraftsSlice = ({ set }: SliceDeps) => {
  return {
    loadSessionSlackDrafts: loadSessionSlackDrafts(set),
    decideSessionSlackDraft: decideSessionSlackDraft(set),
  };
};
