import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { SESSION, seedResolveScene } from './resolveSeed';

const FAILED_THREAD_ID = 'PRRT_thread_idempotency';

export const ResolveFailedHistoryScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: FAILED_THREAD_ID, failure: 'history' });
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
