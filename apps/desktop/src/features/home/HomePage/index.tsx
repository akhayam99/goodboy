import { useMemo } from 'react';
import { PaneShell, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { HomeGrid } from '../grid/HomeGrid';
import { DEFAULT_HOME_LAYOUT, type HomeWidgetId } from '../grid/homeWidgets';
import { visibleWidgetsOf } from '../grid/visibleWidgetsOf';
import { useHomeFacts } from '../hooks/useHomeFacts';
import { useLongRunning } from '../hooks/useLongRunning';
import { useMergedWeek } from '../hooks/useMergedWeek';
import { StartFirstSession } from '../StartFirstSession';
import { LongRunning } from '../widgets/LongRunning';
import { MergedThisWeek } from '../widgets/MergedThisWeek';
import { NeedsYou } from '../widgets/NeedsYou';
import { ProviderLimits } from '../widgets/ProviderLimits';
import { RunningNow } from '../widgets/RunningNow';
import { SessionsToFinish } from '../widgets/SessionsToFinish';
import { Spend } from '../widgets/Spend';
import { TasksInbox } from '../widgets/TasksInbox';
import { WorkflowRules } from '../widgets/WorkflowRules';
import { WorkspaceSetup } from '../widgets/WorkspaceSetup';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly layout?: ReadonlyArray<HomeWidgetId>;
};

export const HomePage = ({ workspaceId, layout = DEFAULT_HOME_LAYOUT }: Props) => {
  const facts = useHomeFacts({ workspaceId });
  const long = useLongRunning({ facts });
  const merged = useMergedWeek();
  const longIds = useMemo(() => new Set<string>(long.map((row) => row.session.id)), [long]);
  const ids = visibleWidgetsOf({
    facts,
    layout,
    mergedCount: merged.rows.length,
    longRunningCount: long.length,
  });
  const isLongShown = ids.includes('longRunning');
  const isEmpty = !facts.isLoading && !facts.hasSessions;
  return (
    <PaneShell page="home" scroll="body" title={NAMES.home}>
      <ScrollFade viewportClassName="flex flex-col gap-3 pb-6">
        {isEmpty ? <StartFirstSession /> : null}
        <HomeGrid
          ids={ids}
          render={({ id, size }) => {
            switch (id) {
              case 'sessionsToFinish':
                return <SessionsToFinish facts={facts} size={size} />;
              case 'needsYou':
                return <NeedsYou facts={facts} size={size} />;
              case 'runningNow':
                return (
                  <RunningNow
                    facts={facts}
                    size={size}
                    longIds={longIds}
                    isLongShown={isLongShown}
                  />
                );
              case 'providerLimits':
                return <ProviderLimits facts={facts} size={size} />;
              case 'spend':
                return <Spend facts={facts} size={size} />;
              case 'tasksInbox':
                return <TasksInbox facts={facts} size={size} />;
              case 'mergedThisWeek':
                return <MergedThisWeek facts={facts} size={size} />;
              case 'longRunning':
                return <LongRunning facts={facts} size={size} />;
              case 'workflowRules':
                return <WorkflowRules facts={facts} size={size} />;
              case 'workspaceSetup':
                return <WorkspaceSetup facts={facts} size={size} />;
              default: {
                const exhaustive: never = id;
                return exhaustive;
              }
            }
          }}
        />
      </ScrollFade>
    </PaneShell>
  );
};
