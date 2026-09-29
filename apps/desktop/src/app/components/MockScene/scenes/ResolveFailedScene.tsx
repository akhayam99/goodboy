import { useEffect, useState } from 'react';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { SESSION, seedResolveScene, type ResolveFailure } from './resolveSeed';

const FAILED_THREAD_ID = 'PRRT_thread_idempotency';

type Props = {
  readonly failure: ResolveFailure;
};

export const ResolveFailedScene = ({ failure }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: FAILED_THREAD_ID, failure });
    setIsReady(true);
  }, [failure]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <ReviewPane session={SESSION} />
    </main>
  );
};

export const ResolveFailedRunScene = () => <ResolveFailedScene failure="run" />;

export const ResolveFailedHistoryScene = () => <ResolveFailedScene failure="history" />;
