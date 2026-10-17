import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { EXPANDED_THREAD_ID, SESSION, THREAD_IDS } from '../resolveSeed';
import { seedCommentsScene } from '../u23/commentsSeed';

export type R4CommentsVariant = 'list' | 'open' | 'ready' | 'failed';

type Props = {
  readonly variant: R4CommentsVariant;
};

type ThreadParams = {
  readonly variant: R4CommentsVariant;
};

const SKIP_MS = 300;

const SKIP_FAILURE = 'The review queue is busy in another window.';

const threadOf = ({ variant }: ThreadParams): string | null => {
  switch (variant) {
    case 'list':
      return null;
    case 'ready':
      return EXPANDED_THREAD_ID;
    case 'open':
    case 'failed':
      return THREAD_IDS.retryConstant;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
};

export const R4CommentsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedCommentsScene({ variant: 'groups' });
    const threadId = threadOf({ variant });
    useAppStore.setState({
      drawer:
        threadId === null
          ? null
          : { kind: 'conversation', sessionId: SESSION.id, payload: { threadId } },
      branchThreadId: { [SESSION.id]: threadId },
      ...(variant === 'failed' && {
        deferResolveQueueItem: async () => {
          throw new Error(SKIP_FAILURE);
        },
      }),
    });
    setIsReady(true);
  }, [variant]);

  useEffect(() => {
    if (!isReady || variant !== 'failed') {
      return;
    }
    const timer = window.setTimeout(
      () => document.querySelector<HTMLElement>('[data-review-verb="reviewComment.skip"]')?.click(),
      SKIP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
