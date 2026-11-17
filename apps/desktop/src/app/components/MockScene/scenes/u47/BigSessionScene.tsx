import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { LOG_LANDING } from '../../../../../features/session/central/log/logLanding';
import { shellArrangement } from '../../../../shellArrangement';
import { BigSessionPane } from './BigSessionPane';
import { BIG_SESSION_ID, seedBigSession } from './bigSessionSeed';

type Props = {
  readonly isLogOpen?: boolean;
};

const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: true });

const WIDTH = 1180;
const HEIGHT = 900;

export const BigSessionScene = ({ isLogOpen = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBigSession();
    if (isLogOpen) {
      LOG_LANDING.request({ sessionId: BIG_SESSION_ID });
    }
    setIsReady(true);
  }, [isLogOpen]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: WIDTH, height: HEIGHT }}
        className="[&>div]:h-full [&>div]:w-full"
      >
        <AppShell
          leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
          leftSidebar={<div aria-hidden />}
          main={<BigSessionPane />}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
