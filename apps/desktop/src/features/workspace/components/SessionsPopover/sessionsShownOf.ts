import type { Session } from '@goodboy/types';
import type { SessionOrder } from '../../../../store';
import { plainText } from '../../../../shared/utils/plainText';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';

type OrderGroup = SessionOrder['groups'][number];

export type ShownGroup = {
  readonly key: OrderGroup['key'];
  readonly count: number;
  readonly sessions: ReadonlyArray<Session>;
};

type Params = {
  readonly groups: ReadonlyArray<OrderGroup>;
  readonly query: string;
  readonly projectOf: Readonly<Record<string, string>>;
};

type MatchParams = {
  readonly session: Session;
  readonly needle: string;
  readonly project: string;
};

const isMatch = ({ session, needle, project }: MatchParams): boolean =>
  plainText({ text: sessionTitle({ session }) })
    .toLowerCase()
    .includes(needle) || project.toLowerCase().includes(needle);

export const sessionsShownOf = ({
  groups,
  query,
  projectOf,
}: Params): ReadonlyArray<ShownGroup> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return groups;
  }
  return groups.flatMap((group) => {
    const sessions = group.sessions.filter((session) =>
      isMatch({ session, needle, project: projectOf[session.id] ?? '' }),
    );
    return sessions.length === 0 ? [] : [{ key: group.key, count: sessions.length, sessions }];
  });
};
