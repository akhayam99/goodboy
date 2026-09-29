import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
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
      <ReviewPane session={SESSION} />
    </main>
  );
};
