import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { SESSION } from './resolveSeed';
import { seedResolveCommitStoryScene } from './resolveCommitStorySeed';

export const ResolveCommitStoryScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveCommitStoryScene();
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
