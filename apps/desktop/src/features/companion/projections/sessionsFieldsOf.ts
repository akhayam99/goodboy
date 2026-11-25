import type { Session, SessionStage } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
import { attentionReasonsOf } from '../../../store/slices/session-view/attentionReasonsOf';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { sessionMarkOf } from '../../session/sessionMarkOf';
import { sessionNodeOf } from '../../session/sessionNode';
import type { SessionLane, SessionRow, SessionsFields } from '../contract/projections';
import { isLiveSession } from './isLiveSession';
import { sessionRefOf } from './sessionRefOf';
import { trainOfferOf } from './trainOfferOf';
import { waitingTextOf } from './waitingTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const LANE_ROW_LIMIT = 30;

const LANES: ReadonlyArray<{ readonly stage: SessionStage; readonly title: string }> = [
  { stage: 'attention', title: NAMES.needsYou },
  { stage: 'running', title: NAMES.running },
  { stage: 'review', title: NAMES.inReview },
  { stage: 'building', title: NAMES.building },
  { stage: 'done', title: NAMES.done },
];

type Params = {
  readonly scope: WorkspaceScope;
  readonly now: number;
};

type RowParams = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly now: number;
};

const sessionRowOf = ({ scope, session, now }: RowParams): SessionRow | null => {
  const info = scope.infos[session.id];
  if (info === undefined) {
    return null;
  }
  const node = sessionNodeOf({ info, isArchived: false });
  const spend = scope.spendUsd[session.id];
  const reason = attentionReasonsOf({ info })[0] ?? null;
  return {
    id: session.id,
    workspaceId: scope.workspace.id,
    ref: sessionRefOf({ tasks: scope.tasks[session.id] }),
    goal: session.goal,
    stage: info.stage,
    mark: sessionMarkOf({ node }),
    words: node.kind === 'needs' || node.kind === 'queue' ? node.label : null,
    tone: reason === null ? null : ATTENTION_REASON_META[reason].tone,
    reason,
    waitingText:
      reason === null ? null : waitingTextOf({ since: info.attentionSince ?? null, now }),
    branch: scope.pullRequests[session.id]?.headBranch ?? null,
    projectNames: scope.projectNames[session.id] ?? [],
    prNumber: scope.pullRequests[session.id]?.number ?? null,
    costText: spend === undefined ? null : formatUsd(spend),
    updatedAt: session.updatedAt,
  };
};

type RecentParams = {
  readonly left: SessionRow;
  readonly right: SessionRow;
};

const byRecent = ({ left, right }: RecentParams): number =>
  left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0;

export const sessionsFieldsOf = ({ scope, now }: Params): SessionsFields => {
  const rows = scope.sessions
    .filter((session) => isLiveSession({ session }))
    .flatMap((session) => {
      const row = sessionRowOf({ scope, session, now });
      return row === null ? [] : [row];
    })
    .sort((left, right) => byRecent({ left, right }));
  const lanes: ReadonlyArray<SessionLane> = LANES.map(({ stage, title }) => {
    const inLane = rows.filter((row) => row.stage === stage);
    return { stage, title, count: inLane.length, rows: inLane.slice(0, LANE_ROW_LIMIT) };
  });
  return { workspaceId: scope.workspace.id, lanes, train: trainOfferOf({ scope }) };
};
