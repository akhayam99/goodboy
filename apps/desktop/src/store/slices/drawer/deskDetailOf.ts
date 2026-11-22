import type { SessionId } from '@goodboy/types';
import type { DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly state: Partial<Pick<DrawerSliceState, 'drawer' | 'drawerBack'>>;
  readonly sessionId: SessionId;
};

const DESK_ORDER: ReadonlyArray<OpenDrawer['kind']> = ['transcript', 'pull-request'];

export const deskDetailOf = ({ state, sessionId }: Params): ReadonlyArray<OpenDrawer> =>
  DESK_ORDER.flatMap((kind) => {
    const entry = [state.drawer ?? null, state.drawerBack ?? null].find(
      (candidate) =>
        candidate !== null && candidate.kind === kind && candidate.sessionId === sessionId,
    );
    return entry === undefined || entry === null ? [] : [entry];
  });
