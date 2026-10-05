import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { SESSION } from './resolveSeed';
import { seedResolveBitbucketScene } from './resolveBitbucketSeed';

export const ResolveBitbucketScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveBitbucketScene({ selected: 'bitbucket' });
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
