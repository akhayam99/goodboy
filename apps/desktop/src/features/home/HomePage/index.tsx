import { useMemo } from 'react';
import { EmptyLine, PaneShell, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { HomeGrid } from '../grid/HomeGrid';
import { visibleWidgetsOf } from '../grid/visibleWidgetsOf';
import { useHomeFacts } from '../hooks/useHomeFacts';
import { useLongRunning } from '../hooks/useLongRunning';
import { useMergedWeek } from '../hooks/useMergedWeek';
import { HiddenTray } from '../layout/HiddenTray';
import type { WidgetGesture } from '../layout/layoutTypes';
import { neighbourOf } from '../layout/neighbourOf';
import { sizesOf } from '../layout/sizesOf';
import { useFocusAfterGesture } from '../hooks/useFocusAfterGesture';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { useHomeWidgetVerbs } from '../hooks/useHomeWidgetVerbs';
import { StartFirstSession } from '../StartFirstSession';
import { HomeTipBar } from '../tips/HomeTipBar';
import { useHomeTip } from '../hooks/useHomeTip';
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
};

export const HomePage = ({ workspaceId }: Props) => {
  const layout = useHomeLayout({ workspaceId });
  const { tip, failedTipId, dismiss } = useHomeTip();
  const { focusAfter } = useFocusAfterGesture();
  const layoutIds = useMemo(() => layout.entries.map((entry) => entry.id), [layout.entries]);
  const sizes = useMemo(() => sizesOf({ entries: layout.entries }), [layout.entries]);
  const facts = useHomeFacts({ workspaceId });
  const long = useLongRunning({ facts });
  const merged = useMergedWeek();
  const longIds = useMemo(() => new Set<string>(long.map((row) => row.session.id)), [long]);
  const ids = visibleWidgetsOf({
    facts,
    layout: layoutIds,
    mergedCount: merged.rows.length,
    longRunningCount: long.length,
  });
  const isLongShown = ids.includes('longRunning');
  const isEmpty = !facts.isLoading && !facts.hasSessions;
  const hide = ({ id }: WidgetGesture) => {
    focusAfter({ target: neighbourOf({ ids, id }) ?? 'tray' });
    layout.hide({ id });
  };
  const show = ({ id }: WidgetGesture) => {
    layout.show({ id });
    focusAfter({ target: id });
  };
  useHomeWidgetVerbs({ isEnabled: layout.isLoaded, onHide: hide, onShow: show });
  return (
    <PaneShell page="home" scroll="body" title={NAMES.home}>
      <ScrollFade viewportClassName="flex flex-col gap-3 pb-6">
        {isEmpty ? <StartFirstSession /> : null}
        {tip === null ? null : (
          <HomeTipBar tip={tip} isFailed={failedTipId === tip.id} onDismiss={dismiss} />
        )}
        {layout.isLoaded && layout.entries.length === 0 ? (
          <EmptyLine>Nothing on Home. Show a card from the Hidden list.</EmptyLine>
        ) : null}
        <HomeGrid
          ids={ids}
          sizes={sizes}
          onHide={layout.isLoaded ? hide : undefined}
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
        {layout.isLoaded ? (
          <HiddenTray
            tray={layout.tray}
            isSaveFailed={layout.isSaveFailed}
            onShow={show}
            onRetry={layout.retry}
          />
        ) : null}
      </ScrollFade>
    </PaneShell>
  );
};
