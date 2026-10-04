import type { Session, SessionExternalTask } from '@goodboy/types';

export const UNTITLED_BASE = 'Untitled session';

type Params = {
  readonly session: Pick<Session, 'goal'> | null | undefined;
};

type DisplayParams = Params & {
  readonly tasks: ReadonlyArray<Pick<SessionExternalTask, 'identifier'>>;
};

const LEADING_ID = /^\[([^\]\n]+)\]\s+/;

export const sessionTitle = ({ session }: Params): string => {
  const raw = session?.goal ?? '';
  return raw.trim() === '' ? UNTITLED_BASE : raw;
};

export const sessionDisplayTitle = ({ session, tasks }: DisplayParams): string => {
  const full = sessionTitle({ session });
  if (tasks.length === 0) {
    return full;
  }
  const known = new Set(tasks.map((task) => task.identifier));
  let rest = full;
  let match = LEADING_ID.exec(rest);
  while (match !== null && known.has(match[1] ?? '')) {
    rest = rest.slice(match[0].length);
    match = LEADING_ID.exec(rest);
  }
  return rest.trim() === '' ? full : rest;
};
