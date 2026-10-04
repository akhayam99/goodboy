import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { SESSION } from './resolveSeed';
import { seedResolveGitlabScene } from './resolveGitlabSeed';

export const ResolveGitlabScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveGitlabScene({ selected: 'gitlab' });
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
