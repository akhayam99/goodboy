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

export type SessionRowTitle = {
  readonly keys: ReadonlyArray<string>;
  readonly title: string;
};

export const sessionRowTitle = ({ session, tasks }: DisplayParams): SessionRowTitle => {
  const full = sessionTitle({ session });
  if (tasks.length === 0) {
    return { keys: [], title: full };
  }
  const known = new Set(tasks.map((task) => task.identifier));
  const keys: Array<string> = [];
  let rest = full;
  let match = LEADING_ID.exec(rest);
  while (match !== null && known.has(match[1] ?? '')) {
    keys.push(match[1] ?? '');
    rest = rest.slice(match[0].length);
    match = LEADING_ID.exec(rest);
  }
  return rest.trim() === '' ? { keys: [], title: full } : { keys, title: rest };
};

export const sessionDisplayTitle = (params: DisplayParams): string => sessionRowTitle(params).title;
