import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { PaneShell, ScrollFade } from '@goodboy/ui';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { AgentsPane } from '../../../../../features/session/components/SessionWorkspace/parts/AgentsPane';
import { QuestionsPane } from '../../../../../features/session/components/SessionWorkspace/parts/QuestionsPane';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { NeedsYouBlock } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/NeedsYouBlock';
import type { NeedsYouOwner } from '../../../../../features/session/timeline/needsYou';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { InboxList } from '../../../../../features/inbox/components/InboxStudio/InboxList';
import { TaskGroupRows } from '../../../../../features/inbox/components/InboxStudio/TaskGroupRows';
import { sourceFailureLine } from '../../../../../features/inbox/sourceFailureLine';
import { ScriptsPanel } from '../../../../../features/scripts/components/ScriptsPanel';
import { useAppStore, type LensKind } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

const OPEN_NOTIFICATIONS_EVENT = 'goodboy:open-notifications';
const OPEN_NOTIFICATIONS_DELAY_MS = 300;

const noop = () => undefined;

const seedEmptySession = (): void => {
  useAppStore.setState({
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPhaseRuns: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionEvents: { [SESSION_ID]: [] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    agentTurnState: {},
  });
};

const seedArtifactsWithoutPlans = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionPlans: { [SESSION_ID]: [] },
    sessionArtifacts: {
      [SESSION_ID]: (state.sessionArtifacts[SESSION_ID] ?? []).filter(
        (artifact) => artifact.kind !== 'plan',
      ),
    },
    artifactFilter: { [SESSION_ID]: 'plan' },
  });
};

const seedNoMounts = (): void => {
  seedEmptySession();
  useAppStore.setState({
    sessionProjectMounts: { [SESSION_ID]: [] },
    sessionWorktrees: { [SESSION_ID]: [] },
    sessionWorktreeRecords: { [SESSION_ID]: [] },
  });
};

const openNotificationsSoon = (): (() => void) => {
  const timer = window.setTimeout(
    () => window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT)),
    OPEN_NOTIFICATIONS_DELAY_MS,
  );
  return () => window.clearTimeout(timer);
};

type StateSceneProps = {
  readonly frame?: 'shell' | 'plain';
  readonly lens?: LensKind | null;
  readonly seed?: () => void;
  readonly afterMount?: () => () => void;
  readonly children: ReactNode;
};

const StateScene = ({
  frame = 'shell',
  lens = null,
  seed = seedEmptySession,
  afterMount,
  children,
}: StateSceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens,
    });
    seed();
    setIsReady(true);
  }, [lens, seed]);

  useEffect(() => {
    if (!isReady || afterMount === undefined) {
      return;
    }
    return afterMount();
  }, [isReady, afterMount]);

  if (!isReady) {
    return null;
  }

  if (frame === 'plain') {
    return (
      <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <div className="mx-auto w-full max-w-2xl px-6 py-6">{children}</div>
        </ScrollFade>
      </main>
    );
  }

  return <ShellFrame session={SESSION} main={children} />;
};

const INBOX_FAILURE = {
  key: 'failure:sentry',
  text: sourceFailureLine({ name: 'Sentry', message: 'The token was refused (401).' }),
  onClick: noop,
};

const NO_GROUP_HANDLERS = {
  selectedKey: null,
  cursorKey: null,
  onExpand: noop,
  onCollapse: noop,
  onSelect: noop,
  onActivate: noop,
  starOf: () => undefined,
  onToggleStar: noop,
};

const NEEDS_YOU_OWNERS: ReadonlyArray<NeedsYouOwner> = [
  {
    id: 'mock-states-owner-pr',
    kind: 'fixRun',
    text: '#318 · 1 question · 5 to review',
    at: null,
    item: null,
    question: null,
    questionIds: [],
    prNumber: 318,
    owed: null,
  },
  {
    id: 'mock-states-owner-rebase',
    kind: 'rebase',
    text: 'Rebase of hl/fix-duplicate-credit stopped ×2',
    at: null,
    item: null,
    question: null,
    questionIds: [],
    prNumber: null,
    owed: null,
  },
];

export const U21_STATES_SCENES: Readonly<Record<string, ComponentType>> = {
  'runs-list-empty': () => (
    <StateScene lens="workflows">
      <SceneRunsSurface session={SESSION} />
    </StateScene>
  ),
  'agents-list-empty': () => (
    <StateScene lens="agents">
      <AgentsPane session={SESSION} />
    </StateScene>
  ),
  'artifacts-empty': () => (
    <StateScene lens="plans">
      <ArtifactStudio sessionId={SESSION_ID} />
    </StateScene>
  ),
  'artifacts-no-match': () => (
    <StateScene lens="plans" seed={seedArtifactsWithoutPlans}>
      <ArtifactStudio sessionId={SESSION_ID} />
    </StateScene>
  ),
  'scripts-empty': () => (
    <StateScene lens="scripts" seed={seedNoMounts}>
      <ScriptsPanel
        workspaceId={SESSION.workspaceId}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />
    </StateScene>
  ),
  'questions-empty': () => (
    <StateScene lens="questions">
      <QuestionsPane session={SESSION} />
    </StateScene>
  ),
  'activity-empty': () => (
    <StateScene frame="plain">
      <SessionOverviewPane session={SESSION} onSelectLens={noop} />
    </StateScene>
  ),
  'notifications-empty': () => (
    <StateScene lens="workflows" afterMount={openNotificationsSoon}>
      <SceneRunsSurface session={SESSION} />
    </StateScene>
  ),
  'inbox-empty': () => (
    <StateScene lens="plans">
      <PaneShell title="Tasks">
        <InboxList
          totalCount={0}
          visibleCount={0}
          connectedCount={1}
          failureCount={0}
          isLoading={false}
          hasFiltersActive={false}
          onOpenSettings={noop}
          onClearFilters={noop}
        >
          {null}
        </InboxList>
      </PaneShell>
    </StateScene>
  ),
  'inbox-error': () => (
    <StateScene lens="plans">
      <PaneShell title="Tasks">
        <InboxList
          totalCount={0}
          visibleCount={0}
          connectedCount={1}
          failureCount={1}
          isLoading={false}
          hasFiltersActive={false}
          onOpenSettings={noop}
          onClearFilters={noop}
        >
          <TaskGroupRows
            label="Sentry"
            records={[]}
            isExpanded={false}
            canCollapse={false}
            lines={[INBOX_FAILURE]}
            {...NO_GROUP_HANDLERS}
          />
        </InboxList>
      </PaneShell>
    </StateScene>
  ),
  'needs-you-card': () => (
    <StateScene frame="plain">
      <NeedsYouBlock owners={NEEDS_YOU_OWNERS} onOpen={noop} />
    </StateScene>
  ),
};
