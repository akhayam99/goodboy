import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import { useAppStore } from '../../../../../store';
import { seedActivityRunScene } from '../activityRunSeed';
import { AppFrame } from '../audit/AppFrame';
import { seedC07 } from '../u25/c07/c07AutoSeed';
import { C06_SESSION_ID, seedC06 } from '../u25/c06ConversationSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly state: 'done' | 'working' | 'failed';
};

export const P11ChatScene = ({ theme, state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    if (state === 'failed') {
      const agent = seedC06({ state: 'failed' });
      useAppStore
        .getState()
        .navigate({ to: agentPlace({ sessionId: C06_SESSION_ID, agentId: agent.id }) });
      setIsReady(true);
      return;
    }
    seedC07({ state, place: 'auto' });
    setIsReady(true);
  }, [theme, state]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
