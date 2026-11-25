import type { Session, SessionStage } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
import { sessionMarkOf } from '../../session/sessionMarkOf';
import { sessionNodeOf } from '../../session/sessionNode';
import type { SessionLane, SessionRow, SessionsFields } from '../contract/projections';
import { isLiveSession } from './isLiveSession';
import { sessionRefOf } from './sessionRefOf';
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
};

type RowParams = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
};

const rowOf = ({ scope, session }: RowParams): SessionRow | null => {
  const info = scope.infos[session.id];
  if (info === undefined) {
    return null;
  }
  const node = sessionNodeOf({ info, isArchived: false });
  const spend = scope.spendUsd[session.id];
  return {
    id: session.id,
    workspaceId: scope.workspace.id,
    ref: sessionRefOf({ tasks: scope.tasks[session.id] }),
    goal: session.goal,
    stage: info.stage,
    mark: sessionMarkOf({ node }),
    words: node.kind === 'needs' || node.kind === 'queue' ? node.label : null,
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

export const sessionsFieldsOf = ({ scope }: Params): SessionsFields => {
  const rows = scope.sessions
    .filter((session) => isLiveSession({ session }))
    .flatMap((session) => {
      const row = rowOf({ scope, session });
      return row === null ? [] : [row];
    })
    .sort((left, right) => byRecent({ left, right }));
  const lanes: ReadonlyArray<SessionLane> = LANES.map(({ stage, title }) => {
    const inLane = rows.filter((row) => row.stage === stage);
    return { stage, title, count: inLane.length, rows: inLane.slice(0, LANE_ROW_LIMIT) };
  });
  return { workspaceId: scope.workspace.id, lanes };
};
