import type { OpenQuestion } from '@goodboy/types';
import { needsYouOf, type NeedsYouMove } from '../../board/needsYou/needsYouOf';
import { attentionMarkOf } from '../../session/attentionMarkOf';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { Decision } from '../contract/decisions';
import type { NeedsYouFields, NeedsYouRow } from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import { isLiveSession } from './isLiveSession';
import { isoOrNull } from './isoOrNull';
import { sessionRefOf } from './sessionRefOf';
import { waitingTextOf } from './waitingTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const NEEDS_YOU_ROW_LIMIT = 60;

type Params = {
  readonly scopes: ReadonlyArray<WorkspaceScope>;
  readonly now: number;
};

type MoveParams = {
  readonly scope: WorkspaceScope;
  readonly move: NeedsYouMove;
  readonly now: number;
};

type DecisionParams = {
  readonly move: NeedsYouMove;
  readonly question: OpenQuestion | undefined;
};

const decisionOf = ({ move, question }: DecisionParams): Decision | null => {
  if (question === undefined || move.questionId === null) {
    return null;
  }
  const version = question.createdAt;
  return {
    kind: 'question',
    actionId: actionIdOf({ kind: 'answerQuestion', objectId: question.id, version }),
    questionId: question.id,
    version,
    text: question.text,
  };
};

const needsYouRowOf = ({ scope, move, now }: MoveParams): NeedsYouRow => {
  const session = sessionById(scope.sessions, move.sessionId);
  const question = scope.openQuestions[move.sessionId]?.find(
    (candidate) => candidate.id === move.questionId,
  );
  return {
    id: move.id,
    workspaceId: scope.workspace.id,
    sessionId: move.sessionId,
    sessionRef: sessionRefOf({ tasks: scope.tasks[move.sessionId] }),
    goal: session?.goal ?? '',
    reason: move.reason,
    tone: ATTENTION_REASON_META[move.reason].tone,
    mark: attentionMarkOf({ reason: move.reason }),
    words: move.title,
    waitingText: waitingTextOf({ since: move.since, now }),
    since: isoOrNull({ at: move.since }),
    decision: decisionOf({ move, question }),
  };
};

type ScopeMoves = {
  readonly scope: WorkspaceScope;
  readonly moves: ReadonlyArray<NeedsYouMove>;
  readonly sessionCount: number;
};

type ScopeParams = {
  readonly scope: WorkspaceScope;
};

const movesOfScope = ({ scope }: ScopeParams): ScopeMoves => {
  const needs = needsYouOf({
    sessions: scope.sessions.filter((session) => isLiveSession({ session })),
    infos: scope.infos,
    openQuestions: scope.openQuestions,
  });
  return { scope, moves: needs.moves, sessionCount: needs.sessionCount };
};

type OrderParams = {
  readonly left: NeedsYouRow;
  readonly right: NeedsYouRow;
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
  return left.since < right.since ? -1 : 1;
};

export const needsYouFieldsOf = ({ scopes, now }: Params): NeedsYouFields => {
  const grouped = scopes.map((scope) => movesOfScope({ scope }));
  const rows = grouped
    .flatMap(({ scope, moves }) => moves.map((move) => needsYouRowOf({ scope, move, now })))
    .sort((left, right) => sinceOrder({ left, right }));
  return {
    moveCount: grouped.reduce((total, group) => total + group.moves.length, 0),
    sessionCount: grouped.reduce((total, group) => total + group.sessionCount, 0),
    workspaces: grouped
      .filter((group) => group.moves.length > 0)
      .map((group) => ({
        workspaceId: group.scope.workspace.id,
        name: group.scope.workspace.name,
        moveCount: group.moves.length,
        sessionCount: group.sessionCount,
      })),
    rows: rows.slice(0, NEEDS_YOU_ROW_LIMIT),
  };
};
