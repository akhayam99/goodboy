import { DEFAULT_HOME_LAYOUT, type HomeWidgetId } from './homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';

type Params = {
  readonly facts: HomeFacts;
};

export const visibleWidgetsOf = ({ facts }: Params): ReadonlyArray<HomeWidgetId> => {
  if (facts.isLoading) {
    return DEFAULT_HOME_LAYOUT;
  }
  return DEFAULT_HOME_LAYOUT.filter((id) => {
    switch (id) {
      case 'sessionsToFinish':
        return facts.toFinish > 0;
      case 'needsYou':
        return facts.counts.needsYou > 0;
      case 'runningNow':
        return facts.running.length > 0;
      case 'providerLimits':
        return true;
      default: {
        const exhaustive: never = id;
        return exhaustive;
      }
    }
  });
};
