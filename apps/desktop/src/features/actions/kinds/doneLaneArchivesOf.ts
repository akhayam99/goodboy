import type { Session, SessionId } from '@goodboy/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const DONE_OLDER_THAN_DAYS = 7;

export type DoneLaneArchive = Readonly<{
  id: 'all' | 'older';
  label: string;
  sessions: ReadonlyArray<Session>;
  blockedReason: string | null;
}>;

type ActivityParams = {
  readonly sessionId: SessionId;
};

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly lastActivityMsOf: (params: ActivityParams) => number | null;
  readonly nowMs: number;
};

export const doneLaneArchivesOf = ({
  sessions,
  lastActivityMsOf,
  nowMs,
}: Params): ReadonlyArray<DoneLaneArchive> => {
  const cutoff = nowMs - DONE_OLDER_THAN_DAYS * DAY_MS;
  const older = sessions.filter((session) => {
    const at = lastActivityMsOf({ sessionId: session.id });
    return at !== null && at < cutoff;
  });
  return [
    {
      id: 'all',
      label: 'Archive all in Done',
      sessions,
      blockedReason: sessions.length === 0 ? 'Nothing is in Done.' : null,
    },
    {
      id: 'older',
      label: `Archive done older than ${DONE_OLDER_THAN_DAYS} days`,
      sessions: older,
      blockedReason:
        older.length === 0 ? `Nothing in Done is older than ${DONE_OLDER_THAN_DAYS} days.` : null,
    },
  ];
};
