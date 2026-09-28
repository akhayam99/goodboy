import { useEffect, useState } from 'react';
import type { IsoDateTime } from '@goodboy/types';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_QUESTION_SESSION, seedOneWaitingAgentScene } from './activityQuestionSeed';
import { ShellFrame, seedShellChrome } from './shellChrome';

export const ActivityOneSignalScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedOneWaitingAgentScene();
    seedShellChrome({
      session: ACTIVITY_QUESTION_SESSION,
      siblings: [],
      branches: { [ACTIVITY_QUESTION_SESSION.id]: 'nw/fix-settlement-rounding' },
      telemetryAt: new Date().toISOString() as IsoDateTime,
      lens: null,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ACTIVITY_QUESTION_SESSION}
      sidebar="expanded"
      main={
        <SessionOverviewPane session={ACTIVITY_QUESTION_SESSION} onSelectLens={() => undefined} />
      }
    />
  );
};
