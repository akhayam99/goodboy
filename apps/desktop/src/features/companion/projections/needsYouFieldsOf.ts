import { needsYouOf, type NeedsYouMove } from '../../board/needsYou/needsYouOf';
import { attentionMarkOf } from '../../session/attentionMarkOf';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { LeadAsk, NeedsYouChips, NeedsYouFields, NeedsYouRow } from '../contract/projections';
import type { Workspace } from '@goodboy/types';
import { decisionOfMove } from './decisionOfMove';
import { isLiveSession } from './isLiveSession';
import { isoOrNull } from './isoOrNull';
import { leadAskOf } from './leadAskOf';
import { leadProposalOf } from './leadProposalOf';
import { sessionRefOf } from './sessionRefOf';
import { waitingTextOf } from './waitingTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const NEEDS_YOU_ROW_LIMIT = 60;

type Params = {
  readonly scopes: ReadonlyArray<WorkspaceScope>;
  readonly workspaces: ReadonlyArray<Pick<Workspace, 'id' | 'name'>>;
  readonly chips: NeedsYouChips;
  readonly now: number;
};

type MoveParams = {
  readonly scope: WorkspaceScope;
  readonly move: NeedsYouMove;
  readonly now: number;
};

type AskParams = {
  readonly scope: WorkspaceScope;
  readonly move: NeedsYouMove;
};

const leadAskFieldsOf = ({ scope, move }: AskParams): LeadAsk | null => {
  const question = leadAskOf({ scope, sessionId: move.sessionId });
  const proposal = leadProposalOf({ scope, sessionId: move.sessionId });
  if (question === null && proposal === null) {
    return null;
  }
  return {
    ...(question === null ? {} : { question }),
    ...(proposal === null ? {} : { proposal }),
  };
};

const needsYouRowOf = ({ scope, move, now }: MoveParams): NeedsYouRow => {
  const session = sessionById(scope.sessions, move.sessionId);
  const question = scope.openQuestions[move.sessionId]?.find(
    (candidate) => candidate.id === move.questionId,
  );
  const ask = move.reason === 'auto-needs-you' ? leadAskFieldsOf({ scope, move }) : null;
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
    decision: decisionOfMove({ scope, move, question }),
    ...(ask === null ? {} : { ask }),
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

export const needsYouFieldsOf = ({ scopes, workspaces, chips, now }: Params): NeedsYouFields => {
  const grouped = scopes.map((scope) => movesOfScope({ scope }));
  const rows = grouped
    .flatMap(({ scope, moves }) => moves.map((move) => needsYouRowOf({ scope, move, now })))
    .sort((left, right) => sinceOrder({ left, right }));
  return {
    chips,
    moveCount: grouped.reduce((total, group) => total + group.moves.length, 0),
    sessionCount: grouped.reduce((total, group) => total + group.sessionCount, 0),
    workspaces: workspaces.map((workspace) => {
      const group = grouped.find((candidate) => candidate.scope.workspace.id === workspace.id);
      return {
        workspaceId: workspace.id,
        name: workspace.name,
        moveCount: group?.moves.length ?? 0,
        sessionCount: group?.sessionCount ?? 0,
      };
    }),
    rows: rows.slice(0, NEEDS_YOU_ROW_LIMIT),
  };
};
