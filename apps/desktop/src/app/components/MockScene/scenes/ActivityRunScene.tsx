import { useEffect, useState } from 'react';
import type { IsoDateTime, ProviderRunId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, seedActivityRunScene, seedSiblingStages } from './activityRunSeed';
import { useHoveredMountRow, useShowCompletedMounts } from './sceneReveal';
import { ShellFrame, seedShellChrome } from './shellChrome';

const HOUR = 3_600_000;

const isoAgo = (offsetMs: number): IsoDateTime =>
  new Date(Date.now() - offsetMs).toISOString() as IsoDateTime;

const sibling = (id: string, goal: string, hoursAgo: number): Session => ({
  ...SESSION,
  id: id as SessionId,
  goal,
  state: { kind: 'idle', lastActivityAt: isoAgo(hoursAgo * HOUR) },
  updatedAt: isoAgo(hoursAgo * HOUR),
});

const running = (id: string, goal: string, minutesAgo: number): Session => ({
  ...sibling(id, goal, 0),
  state: {
    kind: 'running',
    runId: `${id}-run` as ProviderRunId,
    startedAt: isoAgo(minutesAgo * 60_000),
  },
});

const ROUNDING_ID = 'mock-run-sibling-export' as SessionId;
const RECONCILE_ID = 'mock-run-sibling-reconcile' as SessionId;

const SIBLINGS: ReadonlyArray<Session> = [
  sibling('mock-run-sibling-refunds', 'Draft the payout delay notice for the help center', 1),
  sibling('mock-run-sibling-rate-limit', 'Per-tenant limits on the public API', 3),
  running('mock-run-sibling-payout-speed', 'Speed up the payout export for large merchants', 12),
  sibling(ROUNDING_ID, 'Fix the rounding drift in the settlement export', 6),
  sibling(RECONCILE_ID, 'Reconcile the settlement export against the ledger', 26),
];

type Props = {
  readonly contextTab?: ContextDrawerTab;
};

export const ActivityRunScene = ({ contextTab }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    seedShellChrome({
      session: SESSION,
      siblings: SIBLINGS,
      branches: {
        'mock-run-sibling-refunds': 'hl/payout-delay-notice',
        'mock-run-sibling-rate-limit': 'hl/per-tenant-limits',
        'mock-run-sibling-export': 'hl/fix-export-rounding',
        'mock-run-sibling-payout-speed': 'hl/faster-payout-export',
        'mock-run-sibling-reconcile': 'hl/reconcile-settlement-export',
      },
      telemetryAt: isoAgo(HOUR),
      lens: null,
    });
    seedSiblingStages({
      attentionId: ROUNDING_ID,
      reviewId: RECONCILE_ID,
      reviewBranch: 'hl/reconcile-settlement-export',
    });
    useAppStore.setState({ selectedAgentId: {} });
    if (contextTab !== undefined) {
      useAppStore.getState().openContextDrawer({ sessionId: SESSION.id, tab: contextTab });
    }
    setIsReady(true);
  }, [contextTab]);

  useShowCompletedMounts({ isReady });
  useHoveredMountRow({ isReady, rowLabel: 'nw/backfill-processed-events' });

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      sidebar="expanded"
      main={<SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />}
    />
  );
};
