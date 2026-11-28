import { useEffect, useRef, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { START_KIND_COPY } from '../../../../../features/session/startKind/startKindCopy';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { EXPANDED_THREAD_ID, SESSION, seedResolveScene } from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';

type Plan = 'lead' | 'agent';

type Props = {
  readonly extraThreadIds: ReadonlyArray<string>;
  readonly plan?: Plan;
  readonly theme?: 'dark' | 'light';
};

export const CommentRunComposeScene = ({ extraThreadIds, plan = 'lead', theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    const state = useAppStore.getState();
    state.openCommentRunStart({ sessionId: SESSION.id, threadId: EXPANDED_THREAD_ID });
    state.setCommentRunExtras({
      sessionId: SESSION.id,
      threadId: EXPANDED_THREAD_ID,
      extraThreadIds,
    });
    setIsReady(true);
  }, [extraThreadIds, theme]);

  useEffect(() => {
    if (!isReady || plan !== 'agent') {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const tabs = mainRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [];
      [...tabs].find((tab) => tab.textContent === START_KIND_COPY.plan.agent)?.click();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isReady, plan]);

  if (!isReady) {
    return null;
  }

  return (
    <main ref={mainRef} className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
