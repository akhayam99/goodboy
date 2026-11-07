import { useEffect, useState } from 'react';
import { PageTrailContext } from '@goodboy/ui';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SessionBackRow } from '../../../../../features/session/components/SessionWorkspace/SessionBackRow';
import { useAppStore } from '../../../../../store';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { SESSION, SESSION_ID } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed } from '../u23/prPageSeed';

export type HeaderRevealStill = 'top' | 'reading' | 'back';

const SETTLE_MS = 600;
const FRAME_HEIGHT_PX = 640;
const READING_DELTA_PX = 520;
const BACK_DELTA_PX = -24;

type Props = {
  readonly still: HeaderRevealStill;
};

type ScrollParams = {
  readonly delta: number;
};

const userScroll = ({ delta }: ScrollParams): void => {
  const viewport = document.querySelector<HTMLElement>(
    '[data-slot="reveal-spacer"]',
  )?.parentElement;
  if (viewport === null || viewport === undefined) {
    return;
  }
  viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: delta }));
  viewport.scrollTop = viewport.scrollTop + delta;
};

export const HeaderRevealScene = ({ still }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyPrPageSeed({ variant: 'github' });
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: SESSION_ID, mountPath: PR_PAGE_WORKTREE, tab: 'pr' }),
      mode: 'replace',
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || still === 'top') {
      return;
    }
    const reading = window.setTimeout(() => userScroll({ delta: READING_DELTA_PX }), SETTLE_MS);
    const back =
      still === 'back'
        ? window.setTimeout(() => userScroll({ delta: BACK_DELTA_PX }), SETTLE_MS * 2)
        : null;
    return () => {
      window.clearTimeout(reading);
      if (back !== null) {
        window.clearTimeout(back);
      }
    };
  }, [isReady, still]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="overflow-hidden bg-background text-foreground"
      style={{ height: FRAME_HEIGHT_PX }}
    >
      <WorktreeSceneColumn>
        <PageTrailContext.Provider value={<SessionBackRow sessionId={SESSION_ID} />}>
          <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
        </PageTrailContext.Provider>
      </WorktreeSceneColumn>
    </main>
  );
};
