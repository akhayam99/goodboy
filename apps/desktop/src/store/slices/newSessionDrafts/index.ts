import { clearNewSessionDraft } from './clearNewSessionDraft';
import { setNewSessionDraft } from './setNewSessionDraft';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const createNewSessionDraftsSlice = ({ set }: Params) => {
  return {
    setNewSessionDraft: setNewSessionDraft({ set }),
    clearNewSessionDraft: clearNewSessionDraft({ set }),
  };
};
