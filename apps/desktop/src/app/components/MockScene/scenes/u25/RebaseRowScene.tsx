import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { DrawerHost } from '../../../DrawerHost';
import { useSceneClicks } from '../audit/useSceneClicks';
import { SESSION_ID } from '../resolveSeed';
import { CommitsBranchScene } from '../u24/CommitsBranchScene';
import { REBASE_JOB_MOUNT_ID } from '../u24/rebaseJobSeed';
import {
  REBASE_ROW_BACKUPS,
  REBASE_ROW_BRANCHES,
  REBASE_ROW_BRANCH_PATH,
  factsOfPayload,
} from './b-rebase-rowSeed';

type Variant = 'behind' | 'picker' | 'versions';

type Props = {
  readonly variant: Variant;
};

const ANSWERS = {
  worktree_list_branch_names: () => REBASE_ROW_BRANCHES,
  history_backups_list: () => REBASE_ROW_BACKUPS,
  history_backup_facts: (payload: unknown) => factsOfPayload({ payload }),
};

const CLICK_MS = 400;

export const RebaseRowScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (variant !== 'versions') {
      setIsReady(true);
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.getState().openDrawer({
        kind: 'history-versions',
        sessionId: SESSION_ID,
        payload: { mountId: REBASE_JOB_MOUNT_ID, worktreePath: REBASE_ROW_BRANCH_PATH },
      });
      setIsReady(true);
    }, CLICK_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: variant === 'picker' ? ['hl/fix-duplicate-credit'] : [],
    selector: '[role="combobox"]',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  useSceneClicks({
    isReady: isReady && variant === 'versions',
    labels: ['Show commits'],
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS * 4,
  });

  if (variant !== 'versions') {
    return <CommitsBranchScene isPlanned={false} answers={ANSWERS} />;
  }
  return (
    <div className="flex" style={{ width: 1440 }}>
      <div className="min-w-0 flex-1">
        <CommitsBranchScene isPlanned={false} answers={ANSWERS} />
      </div>
      <aside aria-label="Drawer" className="h-screen w-[400px] shrink-0 bg-drawer">
        <DrawerHost />
      </aside>
    </div>
  );
};
