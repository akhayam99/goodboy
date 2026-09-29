import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { SESSION } from './resolveSeed';
import { seedResolveCommitsScene } from './resolveCommitsSeed';

export const ResolveCommitsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveCommitsScene();
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
