import type {
  OpenQuestion,
  Session,
  SessionAttentionReason,
  SessionId,
  SessionStageInfo,
} from '@goodboy/types';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../session/session-stage';
import { attentionCountOf } from '../../../store/slices/session-view/attentionCountOf';
import { attentionReasonsOf } from '../../../store/slices/session-view/attentionReasonsOf';

export type QueueMove = Readonly<{
  id: string;
  sessionId: SessionId;
  reason: SessionAttentionReason;
  title: string;
  since: number | null;
}>;

export type NeedsYou = Readonly<{
  sessionCount: number;
  moveCount: number;
  moves: ReadonlyArray<QueueMove>;
  notNowCount: number;
  notNowIds: ReadonlyArray<string>;
}>;

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly infos: Readonly<Record<string, SessionStageInfo>>;
  readonly openQuestions: Readonly<Record<string, ReadonlyArray<OpenQuestion>>>;
  readonly notNow?: ReadonlySet<string>;
};

const NOTHING: ReadonlySet<string> = new Set();

type SessionParams = {
  readonly session: Session;
  readonly info: SessionStageInfo;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

type ReasonParams = {
  readonly reason: SessionAttentionReason;
};

const isLoud = ({ reason }: ReasonParams): boolean => {
  const { tone } = ATTENTION_REASON_META[reason];
  return tone === 'warning' || tone === 'danger';
};

type AskedParams = {
  readonly question: OpenQuestion;
};

const askedAtOf = ({ question }: AskedParams): number | null => {
  const at = Date.parse(question.createdAt);
  return Number.isNaN(at) ? null : at;
};

const questionMovesOf = ({ session, info, questions }: SessionParams): ReadonlyArray<QueueMove> => {
  const open = questions.filter((question) => question.status === 'open');
  if (open.length === 0) {
    return [
      {
        id: `${session.id}:open-question`,
        sessionId: session.id,
        reason: 'open-question',
        title: attentionWordsOf({ reason: 'open-question', counts: info }),
        since: info.attentionSince ?? null,
      },
    ];
  }
  return open.map((question) => ({
    id: `${session.id}:question:${question.id}`,
    sessionId: session.id,
    reason: 'open-question',
    title: question.text,
    since: askedAtOf({ question }),
  }));
};

const sessionMovesOf = ({ session, info, questions }: SessionParams): ReadonlyArray<QueueMove> =>
  attentionReasonsOf({ info })
    .filter((reason) => isLoud({ reason }))
    .flatMap((reason) =>
      reason === 'open-question'
        ? questionMovesOf({ session, info, questions })
        : [
            {
              id: `${session.id}:${reason}`,
              sessionId: session.id,
              reason,
              title: attentionWordsOf({ reason, counts: info }),
              since: info.attentionSince ?? null,
            },
          ],
    );

type OrderParams = {
  readonly left: QueueMove;
  readonly right: QueueMove;
};

const sinceOrder = ({ left, right }: OrderParams): number => {
  if (left.since === right.since) {
    return 0;
  }
  if (left.since === null) {
    return 1;
  }
  if (right.since === null) {
    return -1;
  }
  return left.since - right.since;
};

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export const needsYouOf = ({
  sessions,
  infos,
  openQuestions,
  notNow = NOTHING,
}: Params): NeedsYou => {
  const items = sessions.flatMap((session) => {
    const info = infos[session.id];
    return info === undefined ? [] : [{ id: session.id, info, session }];
  });
  const { countedIds } = attentionCountOf({ items });
  const counted = new Set(countedIds);
  const all = items
    .filter((item) => counted.has(item.id))
    .flatMap(({ session, info }) =>
      sessionMovesOf({ session, info, questions: openQuestions[session.id] ?? NO_QUESTIONS }),
    )
    .sort((left, right) => sinceOrder({ left, right }));
  const moves = all.filter((move) => !notNow.has(move.id));
  const notNowIds = all.filter((move) => notNow.has(move.id)).map((move) => move.id);
  return {
    sessionCount: countedIds.length,
    moveCount: moves.length,
    moves,
    notNowCount: notNowIds.length,
    notNowIds,
  };
};
