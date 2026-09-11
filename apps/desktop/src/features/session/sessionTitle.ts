import type { Session } from '@goodboy/types';
import { UNTITLED_BASE } from '../../store/slices/sessions/untitledTitle';

type Params = {
  readonly session: Pick<Session, 'goal'> | null | undefined;
};

export const sessionTitle = ({ session }: Params): string => {
  const raw = session?.goal ?? '';
  return raw.trim() === '' ? UNTITLED_BASE : raw;
};
