import type { LatestClaim } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { slotWithGrid } from './slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from './state';
import { parseStoredDockGrid, storedDockGridOf } from './storedDockGrid';

type ApplyParams = SliceDeps & {
  readonly raw: string | null;
  readonly claim: LatestClaim;
  readonly before: DrawerGrid;
};

export const appliedDockGrid = ({ set, get, raw, claim, before }: ApplyParams): string | null => {
  const record = raw === null ? null : parseStoredDockGrid({ raw });
  const state = get();
  if (record === null || !claim.isCurrent() || (state.drawerGrid ?? EMPTY_DRAWER_GRID) !== before) {
    return null;
  }
  set(
    slotWithGrid({
      drawer: state.drawer ?? null,
      back: state.drawerBack ?? null,
      grid: record,
      knownSessionIds: new Set(state.sessions.map((session) => session.id)),
    }),
  );
  return storedDockGridOf({ grid: get().drawerGrid ?? EMPTY_DRAWER_GRID });
};
