import { DEFAULT_HOME_LAYOUT, type HomeWidgetId } from './homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';

type Params = {
  readonly facts: HomeFacts;
  readonly layout?: ReadonlyArray<HomeWidgetId>;
  readonly mergedCount?: number;
  readonly longRunningCount?: number;
};

export const visibleWidgetsOf = ({
  facts,
  layout = DEFAULT_HOME_LAYOUT,
  mergedCount = 0,
  longRunningCount = 0,
}: Params): ReadonlyArray<HomeWidgetId> => {
  if (facts.isLoading) {
    return layout;
  }
  return layout.filter((id) => {
    switch (id) {
      case 'sessionsToFinish':
        return facts.toFinish > 0;
      case 'needsYou':
        return facts.counts.needsYou > 0;
      case 'runningNow':
        return facts.running.length > 0;
      case 'mergedThisWeek':
        return mergedCount > 0;
      case 'longRunning':
        return longRunningCount > 0;
      case 'providerLimits':
      case 'spend':
      case 'tasksInbox':
      case 'workflowRules':
      case 'workspaceSetup':
        return true;
      default: {
        const exhaustive: never = id;
        return exhaustive;
      }
    }
  });
};
