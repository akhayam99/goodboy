import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { EXPANDED_THREAD_ID, SESSION, seedResolveScene } from './resolveSeed';

export const ResolveItemScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
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
