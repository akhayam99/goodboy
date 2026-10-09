import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { seedDesignComments } from './seedDesignComments';

export const DesignCommentsScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedDesignComments();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <main className="h-screen bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={null} />
    </main>
  );
};
