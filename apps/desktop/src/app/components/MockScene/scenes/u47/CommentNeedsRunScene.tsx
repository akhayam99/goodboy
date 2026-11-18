import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { SESSION, THREAD_IDS, seedResolveScene } from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';

type Props = {
  readonly theme?: 'dark' | 'light';
  readonly isComposing?: boolean;
};

export const CommentNeedsRunScene = ({ theme, isComposing = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedResolveScene({ expandedThreadId: THREAD_IDS.idempotency, failure: 'needs_run' });
    if (isComposing) {
      useAppStore
        .getState()
        .openCommentRunStart({ sessionId: SESSION.id, threadId: THREAD_IDS.idempotency });
    }
    setIsReady(true);
  }, [isComposing, theme]);

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
