import type { Session } from '@goodboy/types';
import { FOLD_LIMIT } from './types';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly isFoldOpen: boolean;
  readonly isAlwaysShown: (session: Session) => boolean;
};

type Folded = {
  readonly visible: ReadonlyArray<Session>;
  readonly hiddenCount: number;
};

export const foldSessions = ({ sessions, isFoldOpen, isAlwaysShown }: Params): Folded => {
  if (isFoldOpen || sessions.length <= FOLD_LIMIT) {
    return { visible: sessions, hiddenCount: 0 };
  }
  const visible = sessions.filter((session, index) => index < FOLD_LIMIT || isAlwaysShown(session));
  return { visible, hiddenCount: sessions.length - visible.length };
};
