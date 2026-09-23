import { useEffect, useState } from 'react';
import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, seedActivityRunScene } from './activityRunSeed';
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

const SIBLINGS: ReadonlyArray<Session> = [
  sibling('mock-run-sibling-refunds', 'Refund every charge on split payments', 1),
  sibling('mock-run-sibling-rate-limit', 'Add per-tenant rate limiting to the public API', 3),
  sibling('mock-run-sibling-export', 'Fix the rounding drift in the settlement export', 6),
];

export const ActivityRunScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    seedShellChrome({
      session: SESSION,
      siblings: SIBLINGS,
      branches: {
        'mock-run-sibling-refunds': 'nw/fix-split-refunds',
        'mock-run-sibling-rate-limit': 'nw/feat-tenant-rate-limit',
        'mock-run-sibling-export': 'nw/fix-export-rounding',
      },
      telemetryAt: isoAgo(HOUR),
      lens: null,
    });
    useAppStore.setState({ selectedAgentId: {} });
    setIsReady(true);
  }, []);

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
