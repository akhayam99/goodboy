import type { SessionId } from '@goodboy/types';
import type { LatestClaim } from '../../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../../slice-types';
import type { SessionFace } from '../../session-view/types';
import { gridWithout } from '../gridWithout';
import { isWorkspaceTool } from '../isWorkspaceTool';
import { slotAfterOpen } from '../slotAfterOpen';
import { slotWithGrid } from '../slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type DrawerSliceState } from '../state';
import { parseStoredDeskDetail, parseStoredDockGrid, storedDockGridOf } from './storedDockGrid';
import { UNSAVED_DRAWER_KINDS } from '../unsavedDrawerKinds';

type ApplyParams = SliceDeps & {
  readonly sessionId: SessionId;
  readonly raw: string | null;
  readonly face: SessionFace;
  readonly isDeskShown: boolean;
  readonly claim: LatestClaim;
  readonly before: DrawerGrid;
  readonly isSavedThisRun: boolean;
};

export const appliedDockGrid = ({
  set,
  get,
  sessionId,
  raw,
  face,
  isDeskShown,
  claim,
  before,
  isSavedThisRun,
}: ApplyParams): string | null => {
  const record = raw === null ? null : parseStoredDockGrid({ raw });
  const state = get();
  if (record === null || !claim.isCurrent() || (state.drawerGrid ?? EMPTY_DRAWER_GRID) !== before) {
    return null;
  }
  const slot = slotWithGrid({
    drawer: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: isSavedThisRun ? record : gridWithout({ grid: record, kinds: [...UNSAVED_DRAWER_KINDS] }),
    knownSessionIds: new Set(state.sessions.map((session) => session.id)),
  });
  const isDetailTaken = [state.drawer ?? null, state.drawerBack ?? null].some(
    (entry) =>
      entry !== null && !isWorkspaceTool({ content: entry }) && entry.sessionId === sessionId,
  );
  const detail =
    raw === null || isDetailTaken || !isDeskShown ? [] : parseStoredDeskDetail({ raw, sessionId });
  set(
    detail.reduce<DrawerSliceState>(
      (current, request) =>
        slotAfterOpen({
          drawer: current.drawer,
          back: current.drawerBack,
          grid: current.drawerGrid,
          request,
        }),
      slot,
    ),
  );
  return storedDockGridOf({ grid: get().drawerGrid ?? EMPTY_DRAWER_GRID, face });
};
