import { useEffect, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { RebaseAllCard } from '../../../../../features/history/RebaseAllCard';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { LevelCard } from '../../../SessionRail/SessionLevel/LevelCard';
import { CTX_STATUS } from '../brand/contextBranch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION_ID, seedResolveScene } from '../resolveSeed';
import { REBASE_ALL_MOUNTS, conflictRunOf, rebaseAllRunOf, rebasingRunOf } from './rebaseSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isRunning: boolean;
};

const BEHIND_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 6 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const LABEL_ID = 'u26-rebase-all-projects';

type SeedParams = {
  readonly isRunning: boolean;
};

const seed = ({ isRunning }: SeedParams): void => {
  seedResolveScene({ expandedThreadId: null });
  mockSceneIpc((command) => (command === 'worktree_status' ? BEHIND_STATUS : null));
  const [ledger, relay, payments] = REBASE_ALL_MOUNTS;
  useAppStore.setState((state) => {
    const [project] = state.projects;
    const projects =
      project === undefined
        ? state.projects
        : REBASE_ALL_MOUNTS.map((mount) => ({
            ...project,
            id: mount.projectId,
            name: mount.mountName,
          }));
    return {
      projects,
      sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION_ID]: REBASE_ALL_MOUNTS },
      ...(isRunning &&
        ledger !== undefined &&
        relay !== undefined &&
        payments !== undefined && {
          rebaseAllRuns: { [SESSION_ID]: rebaseAllRunOf() },
          historyRuns: {
            [relay.mountId]: conflictRunOf({
              sessionId: SESSION_ID,
              mountId: relay.mountId,
              files: ['src/retry/backoff.ts', 'src/retry/queue.ts'],
            }),
            [payments.mountId]: rebasingRunOf({ mountId: payments.mountId }),
          },
        }),
    };
  });
};

export const RebaseAllScene = ({ theme, isRunning }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seed({ isRunning });
    setIsReady(true);
  }, [isRunning, theme]);
  if (!isReady) {
    return null;
  }
  return (
    <div data-shot className="flex h-screen min-h-0 bg-background p-4">
      <div className="flex w-72 shrink-0 flex-col gap-2 bg-background p-2">
        <LevelCard id={LABEL_ID} label="Projects" isOpen onToggle={() => undefined}>
          <RebaseAllCard sessionId={SESSION_ID} />
        </LevelCard>
      </div>
    </div>
  );
};
