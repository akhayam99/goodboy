import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { SESSION, seedResolveScene } from './resolveSeed';

export const ResolveScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
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
