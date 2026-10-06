import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../store';
import {
  EXPANDED_THREAD_ID,
  QUESTION_OPTIONS,
  SESSION,
  SESSION_ID,
  seedResolveScene,
} from './resolveSeed';

export const ResolveRunAnsweredScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    useAppStore.setState({
      sessionResolveAnswers: {
        [SESSION_ID]: { [EXPANDED_THREAD_ID]: QUESTION_OPTIONS[0] ?? '' },
      },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={null} />
    </main>
  );
};
