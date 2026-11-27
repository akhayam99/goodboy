import type { SessionId } from '@goodboy/types';
import { mountRequestOf, sessionMountViews, type MountRowState } from '../mountRowModel';
import { storedRequestOf } from './storedRequestOf';

type Params = {
  readonly state: Pick<
    MountRowState,
    'mountGithub' | 'mountRequests' | 'sessionMounts' | 'sessionProjectMounts' | 'mountPrLinks'
  >;
  readonly sessionId: SessionId;
};

export const soleMergedAtOf = ({ state, sessionId }: Params): number | null => {
  const views = sessionMountViews({ state, sessionId }).filter((view) => view.branch !== '');
  const [only] = views;
  if (views.length !== 1 || only === undefined) {
    return null;
  }
  const storedLink = state.mountPrLinks?.[only.id];
  const request =
    mountRequestOf({ state, mountId: only.id }) ??
    (storedLink === undefined ? null : storedRequestOf({ link: storedLink }));
  if (request?.state !== 'merged') {
    return null;
  }
  const mergedAt = Date.parse(
    state.mountGithub?.[only.id]?.pr?.mergedAt ?? storedLink?.mergedAt ?? '',
  );
  return Number.isFinite(mergedAt) ? mergedAt : null;
};
