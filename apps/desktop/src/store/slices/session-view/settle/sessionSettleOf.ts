import {
  isSettledOf,
  msOf,
  settledAtOf,
  type SettleRequest,
  type SettleRequestState,
} from '@goodboy/core/attention';
import type { MountId, ResolveThread, SessionId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { gitlabMountOf } from '../../mount-request/requestOf';
import {
  mountRequestOf,
  sessionMountViews,
  type MountRowState,
} from '../../project-mounts/mountRowModel';
import { storedRequestOf } from '../../project-mounts/workRecord/storedRequestOf';

export type SessionSettleState = Pick<
  MountRowState,
  'mountGithub' | 'mountRequests' | 'sessionMounts' | 'sessionProjectMounts' | 'mountPrLinks'
> &
  Pick<AppState, 'sessionPhaseRuns'> &
  Readonly<{
    sessionResolveThreads?: Readonly<Record<string, ReadonlyArray<Pick<ResolveThread, 'state'>>>>;
  }>;

export type SessionSettle = Readonly<{
  isSettled: boolean;
  settledAt: number | null;
}>;

type Params = {
  readonly state: SessionSettleState;
  readonly sessionId: SessionId;
};

type MountParams = {
  readonly state: SessionSettleState;
  readonly mountId: MountId;
};

const NOT_SETTLED: SessionSettle = { isSettled: false, settledAt: null };

const mergedAtOf = ({ state, mountId }: MountParams): number | null =>
  msOf({
    value:
      state.mountGithub?.[mountId]?.pr?.mergedAt ??
      gitlabMountOf({ state, mountId })?.mr?.mergedAt ??
      state.mountPrLinks?.[mountId]?.mergedAt,
  });

const storedRequestIn = ({ state, mountId }: MountParams) => {
  const storedLink = state.mountPrLinks?.[mountId];
  return storedLink === undefined ? null : storedRequestOf({ link: storedLink });
};

const settleRequestOf = ({ state, mountId }: MountParams): SettleRequest => {
  const request = mountRequestOf({ state, mountId }) ?? storedRequestIn({ state, mountId });
  if (request === null) {
    return { state: 'unknown', mergedAt: null };
  }
  const kind: SettleRequestState =
    request.state === 'merged' || request.state === 'closed' ? request.state : 'open';
  return { state: kind, mergedAt: kind === 'merged' ? mergedAtOf({ state, mountId }) : null };
};

export const sessionSettleOf = ({ state, sessionId }: Params): SessionSettle => {
  const requests = sessionMountViews({ state, sessionId })
    .filter((view) => view.branch !== '')
    .map((view) => settleRequestOf({ state, mountId: view.id }));
  if (requests.length === 0) {
    return NOT_SETTLED;
  }
  const threads = state.sessionResolveThreads?.[sessionId] ?? [];
  const agentStartedAts = (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) => {
    const startedAt = msOf({ value: agent.startedAt });
    return startedAt === null ? [] : [startedAt];
  });
  if (!isSettledOf({ requests, threads, agentStartedAts })) {
    return NOT_SETTLED;
  }
  return { isSettled: true, settledAt: settledAtOf({ requests, threads }) };
};
