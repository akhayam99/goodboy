import type { Session } from '@goodboy/types';

type Params = {
  readonly session: Session;
};

export const isLiveSession = ({ session }: Params): boolean =>
  session.archivedAt == null && session.deletedAt == null;
