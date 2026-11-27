import type { SessionId } from '@goodboy/types';
import {
  mountRequestOf,
  type MountRequestState,
  type MountRequestView,
} from '../project-mounts/mountRowModel';
import { storedRequestOf } from '../project-mounts/workRecord/storedRequestOf';
import type { AppState } from '../../types';
import { isPullRequestApproved } from './pullRequestGroup';
import type { StagePullRequest } from './attentionFactsOf';

export type StageRequest = Readonly<{
  pr: StagePullRequest;
  requestLabel: string;
}>;

type SessionStageRequestState = MountRequestState &
  Pick<AppState, 'sessionMounts'> &
  Partial<Pick<AppState, 'mountPrLinks'>>;

type Params = {
  readonly state: SessionStageRequestState;
  readonly sessionId: SessionId;
};

type RankParams = {
  readonly request: MountRequestView;
};

const rankOf = ({ request }: RankParams): number => {
  if (request.state === 'merged' || request.state === 'closed') {
    return 0;
  }
  if (request.checks === 'failure') {
    return 5;
  }
  if (request.reviewDecision === 'changes_requested') {
    return 4;
  }
  if (isPullRequestApproved({ pr: request })) {
    return 3;
  }
  if (request.state === 'queued') {
    return 1;
  }
  return 2;
};

const worstMountRequestOf = ({
  requests,
}: {
  readonly requests: ReadonlyArray<MountRequestView>;
}): MountRequestView | null => {
  let worst: MountRequestView | null = null;
  for (const request of requests) {
    if (worst === null || rankOf({ request }) > rankOf({ request: worst })) {
      worst = request;
    }
  }
  return worst;
};

const isSettledRequest = ({ request }: RankParams): boolean =>
  request.state === 'merged' || request.state === 'closed';

const historyRequestsOf = ({ state, sessionId }: Params): ReadonlyArray<MountRequestView> => {
  const history = (state.sessionMounts?.[sessionId] ?? [])
    .filter((view) => !view.isAttached)
    .flatMap((view) => {
      const request = mountRequestOf({ state, mountId: view.id });
      if (request !== null) {
        return [request];
      }
      const link = state.mountPrLinks?.[view.id];
      return link === undefined ? [] : [storedRequestOf({ link })];
    });
  const live = history.filter((request) => !isSettledRequest({ request }));
  const merged = history.find((request) => request.state === 'merged');
  return merged === undefined ? live : [...live, merged];
};

export const sessionStageRequestOf = ({ state, sessionId }: Params): StageRequest | null => {
  const attached = (state.sessionMounts?.[sessionId] ?? [])
    .filter((view) => view.isAttached)
    .flatMap((view) => mountRequestOf({ state, mountId: view.id }) ?? []);
  const requests = [...attached, ...historyRequestsOf({ state, sessionId })];
  const worst = worstMountRequestOf({ requests });
  if (worst === null) {
    return null;
  }
  const pr: StagePullRequest = worst;
  return { pr, requestLabel: worst.label };
};
