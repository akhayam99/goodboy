import type { Session } from '@goodboy/types';

export const UNTITLED_BASE = 'Untitled session';

type Params = {
  readonly session: Pick<Session, 'goal'> | null | undefined;
};

export const sessionTitle = ({ session }: Params): string => {
  const raw = session?.goal ?? '';
  return raw.trim() === '' ? UNTITLED_BASE : raw;
};
