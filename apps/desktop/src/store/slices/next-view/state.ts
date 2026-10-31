import type { SessionId } from '@goodboy/types';

export type NextViewState = {
  readonly nextSeenSubjects: Readonly<Record<SessionId, ReadonlyArray<string>>>;
};

export const nextViewInitialState: NextViewState = {
  nextSeenSubjects: {},
};
