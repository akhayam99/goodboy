import { useEffect, useState } from 'react';
import type { ImpactOverview, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { SegmentedTabs } from '@goodboy/ui';
import { ImpactTabs } from '../../../../../features/impact/components/ImpactStudio/ImpactTabs';
import { OverviewPanel } from '../../../../../features/impact/components/ImpactStudio/OverviewPanel';
import { IMPACT_WINDOW_OPTIONS } from '../../../../../features/impact/lib';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../../store';
import { StudioFrame } from '../StudioFrame';
import { mockWorkspace, seedStudioChrome } from '../shellChrome';
import { BRAND_WORKSPACE_NAME } from '../brand/canon';

const WORKSPACE_ID = 'mock-features-impact-workspace' as WorkspaceId;

const sessionOf = (name: string): SessionId => `mock-features-impact-${name}` as SessionId;

const CREDIT = sessionOf('duplicate-credit');
const HOLD = sessionOf('payout-hold');
const EXPORT = sessionOf('settlement-export');
const LIMITS = sessionOf('per-tenant-limits');
const CRON = sessionOf('export-cron');

const GOALS = new Map<SessionId, string>([
  [CREDIT, 'Stop retried webhooks posting a second credit'],
  [HOLD, 'Warn merchants before a payout hold'],
  [EXPORT, 'Reconcile the settlement export against the ledger snapshot'],
  [LIMITS, 'Per-tenant limits on the public API'],
  [CRON, 'Retire the legacy export cron job'],
]);

const goalOf = (sessionId: SessionId): string => GOALS.get(sessionId) ?? '';

const OVERVIEW: ImpactOverview = {
  sessionCount: 24,
  deletedSessionCount: 0,
  orchestratedSessions: 15,
  previousSessionCount: 19,
  previousOrchestratedSessions: 10,
  medianSessionHours: 1.4,
  previousMedianSessionHours: 1.9,
  sessions: [
    { sessionId: CREDIT, goal: goalOf(CREDIT), value: 2.6, isDeleted: false },
    { sessionId: HOLD, goal: goalOf(HOLD), value: 1.8, isDeleted: false },
    { sessionId: EXPORT, goal: goalOf(EXPORT), value: 3.1, isDeleted: false },
    { sessionId: LIMITS, goal: goalOf(LIMITS), value: 2.2, isDeleted: false },
    { sessionId: CRON, goal: goalOf(CRON), value: 0.9, isDeleted: false },
  ],
  spendUsd: 250.77,
  spendSessions: [],
};

const entryOf = (sessionId: SessionId, number: number, title: string, spendUsd: number) => ({
  sessionId,
  goal: goalOf(sessionId),
  number,
  title,
  state: 'merged' as const,
  spendUsd,
  isDeleted: false,
});

const PULL_REQUESTS: PullRequestOutcomes = {
  open: 3,
  merged: 17,
  closed: 2,
  previousOpen: 2,
  previousMerged: 13,
  entries: [
    entryOf(CREDIT, 318, 'Credit once per event id', 3.47),
    entryOf(CREDIT, 57, 'Skip repeated notifications', 1.12),
    entryOf(EXPORT, 90, 'Reconcile the settlement export', 6.4),
    entryOf(HOLD, 61, 'Warn before a payout hold', 2.85),
    entryOf(CRON, 74, 'Retire the export cron', 0.9),
  ],
};

const REVIEWS: ReviewOutcomes = {
  commentsResolved: 46,
  previousCommentsResolved: 38,
  sentToAgent: 0,
  medianResolveHours: 0.6,
  publishedDrafts: 21,
  pushedResolutions: 19,
  resolutionOutcomes: [],
  resolutionDurationsHours: [],
  hotFiles: [],
  sessions: [],
};

const noop = (): void => undefined;

const seedScene = (): void => {
  seedStudioChrome();
  useAppStore.setState({
    workspaces: [mockWorkspace({ id: WORKSPACE_ID, name: BRAND_WORKSPACE_NAME })],
    currentWorkspaceId: WORKSPACE_ID,
    navigate: () => undefined,
  });
};

export const FeaturesImpactOverviewScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  const header = <ImpactTabs value="overview" onChange={noop} />;

  return (
    <StudioFrame
      target={{ place: 'impact', tool: null }}
      main={
        <StudioShell
          icon={CONCEPT_ICONS.impact}
          tone={CONCEPT_TONE.impact}
          title="Impact"
          subtitle="What Goodboy got done, and what it cost."
          closeLabel="close impact"
          headerAccessory={
            <SegmentedTabs
              ariaLabel="Impact window"
              options={IMPACT_WINDOW_OPTIONS}
              value="last30"
              onChange={noop}
              size="sm"
            />
          }
          onClose={noop}
        >
          {() => (
            <div className="flex min-h-0 min-w-0 flex-1">
              <OverviewPanel
                header={header}
                overview={{ data: OVERVIEW, error: null }}
                pullRequests={{ data: PULL_REQUESTS, error: null }}
                reviews={{ data: REVIEWS, error: null }}
                isLoading={false}
                onRetryOverview={noop}
                onRetryShipped={noop}
                onSelectTab={noop}
                onOpenSession={noop}
                onStartSession={noop}
              />
            </div>
          )}
        </StudioShell>
      }
    />
  );
};
