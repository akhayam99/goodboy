import type { LatestClaim } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import type { SessionFace } from '../session-view/types';
import { gridWithout } from './gridWithout';
import { slotWithGrid } from './slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from './state';
import { parseStoredDockGrid, storedDockGridOf } from './storedDockGrid';
import { UNSAVED_DRAWER_KINDS } from './unsavedDrawerKinds';

type ApplyParams = SliceDeps & {
  readonly raw: string | null;
  readonly face: SessionFace;
  readonly claim: LatestClaim;
  readonly before: DrawerGrid;
  readonly isSavedThisRun: boolean;
};

export const appliedDockGrid = ({
  set,
  get,
  raw,
  face,
  claim,
  before,
  isSavedThisRun,
}: ApplyParams): string | null => {
  const record = raw === null ? null : parseStoredDockGrid({ raw });
  const state = get();
  if (record === null || !claim.isCurrent() || (state.drawerGrid ?? EMPTY_DRAWER_GRID) !== before) {
    return null;
  }
  set(
    slotWithGrid({
      drawer: state.drawer ?? null,
      back: state.drawerBack ?? null,
      grid: isSavedThisRun
        ? record
        : gridWithout({ grid: record, kinds: [...UNSAVED_DRAWER_KINDS] }),
      knownSessionIds: new Set(state.sessions.map((session) => session.id)),
    }),
  );
  return storedDockGridOf({ grid: get().drawerGrid ?? EMPTY_DRAWER_GRID, face });
};
