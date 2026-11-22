import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { attentionReasonsOf } from '../../../store/slices/session-view/attentionReasonsOf';

export type ReadyRow = Readonly<{
  sessionId: SessionId;
  number: number | null;
}>;

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly infos: Readonly<Record<string, SessionStageInfo>>;
  readonly numbers: Readonly<Record<string, number>>;
};

export const readyToMergeOf = ({ sessions, infos, numbers }: Params): ReadonlyArray<ReadyRow> =>
  sessions
    .flatMap((session) => {
      const info = infos[session.id];
      if (info === undefined || !attentionReasonsOf({ info }).includes('pr-approved')) {
        return [];
      }
      return [{ session, since: info.attentionSince ?? Number.MAX_SAFE_INTEGER }];
    })
    .sort((left, right) => left.since - right.since)
    .map(({ session }) => ({ sessionId: session.id, number: numbers[session.id] ?? null }));
