import { useEffect, useState } from 'react';
import type { IsoDateTime, ProviderRunId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SessionWorkspace } from '../../../../features/session/components/SessionWorkspace';
import {
  SESSION,
  finishActivityRuns,
  seedActivityRunScene,
  seedSiblingStages,
} from './activityRunSeed';
import { useHoveredMountRow, useShowCompletedMounts } from './sceneReveal';
import { ShellFrame, seedShellChrome } from './shellChrome';

const HOUR = 3_600_000;

type AgoParams = {
  readonly offsetMs: number;
};

const isoAgo = ({ offsetMs }: AgoParams): IsoDateTime =>
  new Date(Date.now() - offsetMs).toISOString() as IsoDateTime;

type SiblingParams = {
  readonly id: string;
  readonly goal: string;
  readonly hoursAgo: number;
};

const sibling = ({ id, goal, hoursAgo }: SiblingParams): Session => ({
  ...SESSION,
  id: id as SessionId,
  goal,
  state: { kind: 'idle', lastActivityAt: isoAgo({ offsetMs: hoursAgo * HOUR }) },
  updatedAt: isoAgo({ offsetMs: hoursAgo * HOUR }),
});

type RunningParams = {
  readonly id: string;
  readonly goal: string;
  readonly minutesAgo: number;
};

const running = ({ id, goal, minutesAgo }: RunningParams): Session => ({
  ...sibling({ id, goal, hoursAgo: 0 }),
  state: {
    kind: 'running',
    runId: `${id}-run` as ProviderRunId,
    startedAt: isoAgo({ offsetMs: minutesAgo * 60_000 }),
  },
});

const ROUNDING_ID = 'mock-run-sibling-export' as SessionId;
const RECONCILE_ID = 'mock-run-sibling-reconcile' as SessionId;

const SIBLINGS: ReadonlyArray<Session> = [
  sibling({
    id: 'mock-run-sibling-refunds',
    goal: 'Draft the payout delay notice for the help center',
    hoursAgo: 1,
  }),
  sibling({
    id: 'mock-run-sibling-rate-limit',
    goal: 'Per-tenant limits on the public API',
    hoursAgo: 3,
  }),
  running({
    id: 'mock-run-sibling-payout-speed',
    goal: 'Speed up the payout export for large merchants',
    minutesAgo: 12,
  }),
  sibling({
    id: ROUNDING_ID,
    goal: 'Fix the rounding drift in the settlement export',
    hoursAgo: 6,
  }),
  sibling({
    id: RECONCILE_ID,
    goal: 'Reconcile the settlement export against the ledger',
    hoursAgo: 26,
  }),
];

type Props = {
  readonly contextTab?: ContextDrawerTab;
  readonly isFinished?: boolean;
  readonly onSeeded?: () => void;
  readonly isPageFollowed?: boolean;
};

const IDLE_SESSION: Session = {
  ...SESSION,
  state: { kind: 'idle', lastActivityAt: SESSION.updatedAt },
};

export const ActivityRunScene = ({
  contextTab,
  isFinished = false,
  onSeeded,
  isPageFollowed = false,
}: Props) => {
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
      telemetryAt: isoAgo({ offsetMs: HOUR }),
      lens: null,
    });
    seedSiblingStages({
      attentionId: ROUNDING_ID,
      reviewId: RECONCILE_ID,
      reviewBranch: 'hl/reconcile-settlement-export',
    });
    useAppStore.setState({ selectedAgentId: {} });
    if (isFinished) {
      finishActivityRuns();
    }
    if (contextTab !== undefined) {
      useAppStore.getState().openContextDrawer({ sessionId: SESSION.id, tab: contextTab });
    }
    onSeeded?.();
    setIsReady(true);
  }, [contextTab, isFinished, onSeeded]);

  useShowCompletedMounts({ isReady });
  useHoveredMountRow({ isReady, rowLabel: 'nw/backfill-processed-events' });

  if (!isReady) {
    return null;
  }

  const session = isFinished ? IDLE_SESSION : SESSION;
  return (
    <ShellFrame
      session={session}
      sidebar="expanded"
      hasOwnTrail={isPageFollowed}
      main={
        isPageFollowed ? (
          <div className="relative h-full w-full">
            <SessionWorkspace session={session} isActive />
          </div>
        ) : (
          <SessionOverviewPane session={session} onSelectLens={() => undefined} />
        )
      }
    />
  );
};
