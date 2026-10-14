import type { SessionId } from '@goodboy/types';

export type NewDrawerDraft = {
  readonly autoGoal: string;
};

export type NewDrawerDraftsState = {
  readonly newDrawerDrafts: Readonly<Record<SessionId, NewDrawerDraft | undefined>>;
};

export const newDrawerDraftsInitialState: NewDrawerDraftsState = {
  newDrawerDrafts: {},
};
