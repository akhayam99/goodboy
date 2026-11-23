import type { MountId, SessionId } from '@goodboy/types';
import { mountRequestOf, sessionMountViews, type MountRowState } from '../mountRowModel';
import { storedRequestOf } from './storedRequestOf';

type Params = {
  readonly state: Pick<
    MountRowState,
    'mountGithub' | 'mountRequests' | 'sessionMounts' | 'sessionProjectMounts' | 'mountPrLinks'
  >;
  readonly sessionId: SessionId;
};

export const settledMountIdsOf = ({ state, sessionId }: Params): ReadonlyArray<MountId> =>
  sessionMountViews({ state, sessionId }).flatMap((view) => {
    const storedLink = state.mountPrLinks?.[view.id];
    const request =
      mountRequestOf({ state, mountId: view.id }) ??
      (storedLink === undefined ? null : storedRequestOf({ link: storedLink }));
    return request?.state === 'merged' || request?.state === 'closed' ? [view.id] : [];
  });
