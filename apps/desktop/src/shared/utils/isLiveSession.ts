import type { Session } from '@goodboy/types';

type Params = {
  readonly session: Pick<Session, 'archivedAt' | 'deletedAt'> | undefined;
};

export const isLiveSession = ({ session }: Params): boolean =>
  session !== undefined && session.archivedAt === undefined && session.deletedAt === undefined;
