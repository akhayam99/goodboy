import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { SESSION, THREAD_IDS, seedResolveScene } from './resolveSeed';

export const ResolveRunWorkingScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: THREAD_IDS.idempotency });
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
