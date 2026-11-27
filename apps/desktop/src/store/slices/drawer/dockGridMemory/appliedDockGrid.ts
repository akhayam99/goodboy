import type { SessionId } from '@goodboy/types';
import type { LatestClaim } from '../../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../../slice-types';
import type { SessionFace } from '../../session-view/types';
import { isWorkspaceTool } from '../isWorkspaceTool';
import { slotAfterOpen } from '../slotAfterOpen';
import { slotWithGrid } from '../slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type DrawerSliceState } from '../state';
import { parseStoredDeskDetail, parseStoredDockGrid, storedDockGridOf } from './storedDockGrid';
import { layoutOntoGrid } from './layoutOntoGrid';
import { NOTHING_CHANGED } from '../../notifications/errorRecovery';
import { unreadableDockGrids } from './unreadableDockGrids';

type ApplyParams = SliceDeps & {
  readonly sessionId: SessionId;
  readonly raw: string | null;
  readonly face: SessionFace;
  readonly isDeskShown: boolean;
  readonly claim: LatestClaim;
  readonly before: DrawerGrid;
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
}: ApplyParams): string | null => {
  const record = raw === null ? null : parseStoredDockGrid({ raw });
  const state = get();
  if (raw !== null && record === null && claim.isCurrent()) {
    if (unreadableDockGrids.takeNotice({ sessionId })) {
      void state.reportError({
        recovery: NOTHING_CHANGED,
        title: "Couldn't read the saved panels of this session",
        error: new Error('The saved layout is in a shape this version does not read.'),
        severity: 'warning',
        sessionId,
        stays: 'The default layout is shown.',
        coalesceKey: `dock-grid-unreadable:${sessionId}`,
      });
    }
    return null;
  }
  if (record === null || !claim.isCurrent() || (state.drawerGrid ?? EMPTY_DRAWER_GRID) !== before) {
    return null;
  }
  const slot = slotWithGrid({
    drawer: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: layoutOntoGrid({ live: before, saved: record }),
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
