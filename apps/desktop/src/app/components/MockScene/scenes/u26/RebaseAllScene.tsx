import { useEffect, useState } from 'react';
import type { SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { SessionLevel } from '../../../SessionRail/SessionLevel';
import { CTX_STATUS } from '../brand/contextBranch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION, SESSION_ID, seedResolveScene } from '../resolveSeed';
import {
  BATCH_CONFLICT_MOUNT,
  BATCH_REBASING_MOUNT,
  REBASE_ALL_MOUNTS,
  REBASE_BATCH_MOUNTS,
  conflictRunOf,
  rebaseAllRunOf,
  rebasingRunOf,
} from './rebaseSeed';

export type RebaseAllStage = 'idle' | 'running' | 'auto';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly stage: RebaseAllStage;
};

const BEHIND_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 6 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const REBASED_STATUS: WorktreeStatus = {
  ...BEHIND_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
};

const AUTO_RESOLVING_STATUS: WorktreeStatus = {
  ...BEHIND_STATUS,
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 1, changed: 1 },
  inProgress: 'rebase',
};

const REBASED_SLUGS: ReadonlyArray<string> = [
  'fix-duplicate-credit',
  'retry-credit-notes',
  'retry-copy',
];

type SeedParams = {
  readonly stage: RebaseAllStage;
};

type StatusParams = {
  readonly payload: unknown;
  readonly stage: RebaseAllStage;
};

const statusOf = ({ payload, stage }: StatusParams): WorktreeStatus => {
  if (stage !== 'auto') {
    return BEHIND_STATUS;
  }
  const text = JSON.stringify(payload ?? {});
  if (text.includes('webhook-backoff')) {
    return AUTO_RESOLVING_STATUS;
  }
  const isRebased = REBASED_SLUGS.some((slug) => text.includes(slug));
  return isRebased ? REBASED_STATUS : BEHIND_STATUS;
};

const seed = ({ stage }: SeedParams): void => {
  seedResolveScene({ expandedThreadId: null });
  mockSceneIpc((command, payload) =>
    command === 'worktree_status' ? statusOf({ payload, stage }) : null,
  );
  const mounts: ReadonlyArray<SessionProjectMount> =
    stage === 'idle' ? REBASE_ALL_MOUNTS : REBASE_BATCH_MOUNTS;
  useAppStore.setState((state) => {
    const [project] = state.projects;
    const projects =
      project === undefined
        ? state.projects
        : [...new Map(mounts.map((mount) => [mount.projectId, mount])).values()].map((mount) => ({
            ...project,
            id: mount.projectId,
            name: mount.mountName,
          }));
    return {
      projects,
      sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION_ID]: mounts },
      ...(stage !== 'idle' &&
        BATCH_CONFLICT_MOUNT !== undefined &&
        BATCH_REBASING_MOUNT !== undefined && {
          rebaseAllRuns: { [SESSION_ID]: rebaseAllRunOf({ isAuto: stage === 'auto' }) },
          historyRuns: {
            [BATCH_CONFLICT_MOUNT.mountId]: conflictRunOf({
              sessionId: SESSION_ID,
              mountId: BATCH_CONFLICT_MOUNT.mountId,
              files: ['src/retry/backoff.ts', 'src/retry/queue.ts'],
            }),
            [BATCH_REBASING_MOUNT.mountId]:
              stage === 'auto'
                ? conflictRunOf({
                    sessionId: SESSION_ID,
                    mountId: BATCH_REBASING_MOUNT.mountId,
                    files: ['src/retry/backoff.ts'],
                  })
                : rebasingRunOf({ mountId: BATCH_REBASING_MOUNT.mountId }),
          },
        }),
    };
  });
};

export const RebaseAllScene = ({ theme, stage }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seed({ stage });
    setIsReady(true);
  }, [stage, theme]);
  if (!isReady) {
    return null;
  }
  return (
    <div data-shot className="flex h-screen min-h-0 bg-background p-4">
      <div className="flex w-72 shrink-0 flex-col bg-background">
        <ObjectMenuProvider>
          <SessionLevel session={SESSION} isActive />
        </ObjectMenuProvider>
      </div>
    </div>
  );
};
