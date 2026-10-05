import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../store';
import { SESSION } from './resolveSeed';
import { BULK_LAUNCH_THREAD_IDS, seedBulkScene, type BulkStage } from './bulkSeed';

const ANSWERS_BUTTON = /^Use the recommended answers/;
const OPEN_ATTEMPTS = 20;

const openAnswersPanel = (attempt = 0): void => {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    ANSWERS_BUTTON.test(candidate.textContent ?? ''),
  );
  if (button !== undefined) {
    button.click();
    return;
  }
  if (attempt < OPEN_ATTEMPTS) {
    requestAnimationFrame(() => openAnswersPanel(attempt + 1));
  }
};

const ResolveBulkScene = ({ stage }: { readonly stage: BulkStage }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBulkScene({ stage });
    if (stage === 'launch') {
      const state = useAppStore.getState();
      state.setReviewSelection({ sessionId: SESSION.id, threadIds: BULK_LAUNCH_THREAD_IDS });
      state.requestReviewLaunch({ sessionId: SESSION.id, threadIds: BULK_LAUNCH_THREAD_IDS });
    }
    setIsReady(true);
    if (stage === 'answers') {
      openAnswersPanel();
    }
  }, [stage]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={null} />
    </main>
  );
};

export const ResolveBulkLaunchScene = () => <ResolveBulkScene stage="launch" />;
export const ResolveBulkAnswersScene = () => <ResolveBulkScene stage="answers" />;
export const ResolveBulkReviewScene = () => <ResolveBulkScene stage="review" />;
export const ResolveBulkAcceptedScene = () => <ResolveBulkScene stage="accepted" />;
export const ResolveBulkRetryScene = () => <ResolveBulkScene stage="retry" />;
