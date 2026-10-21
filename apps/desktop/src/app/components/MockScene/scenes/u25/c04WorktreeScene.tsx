import { useEffect, useState, type ReactNode } from 'react';
import type { MountId, ProjectId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { useAppStore, useCurrentSession } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import type { BranchTab } from '../../../../../store/slices/navigation/types';
import { branchPlace, sessionPlace } from '../../../../../store/slices/navigation/place';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SideColumn } from '../../../SideColumn';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { useSceneRailFold } from '../useSceneRailFold';
import { useSceneFileRailFold } from '../useSceneFileRailFold';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { CTX_STATUS } from '../brand/contextBranch';
import { handlersFor } from '../brand/DiffStage';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION, SESSION_ID } from '../resolveSeed';
import {
  PR_PAGE_WORKTREE,
  applyPrPageSeed,
  prPageGhStdout,
  type PrPageVariant,
} from '../u23/prPageSeed';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openTerminalStudio: noop,
  openNewChat: noop,
  openNewTerminal: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

const LEDGER_PROJECT_ID = brandedId<ProjectId>({ value: 'mock-c04-project-ledger-core' });
const LEDGER_WORKTREE = '/w/harborline/ledger-core-export-batch';
const NOTIFY_PROJECT_ID = brandedId<ProjectId>({ value: 'mock-c04-project-notify-relay' });
const NOTIFY_WORKTREE = '/w/harborline/notify-relay-retry-copy';

const LEDGER_MOUNT: SessionProjectMount = {
  mountId: brandedId<MountId>({ value: 'mock-c04-mount-ledger-core' }),
  sessionId: SESSION_ID,
  projectId: LEDGER_PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: LEDGER_WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/w/harborline/ledger-core',
  branch: 'hl/export-batch',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const NOTIFY_MOUNT: SessionProjectMount = {
  ...LEDGER_MOUNT,
  mountId: brandedId<MountId>({ value: 'mock-c04-mount-notify-relay' }),
  projectId: NOTIFY_PROJECT_ID,
  mountName: 'notify-relay',
  worktreePath: NOTIFY_WORKTREE,
  repoRoot: '/w/harborline/notify-relay',
  branch: 'hl/retry-copy',
};

export type WorktreeSceneConfig = {
  readonly variant: PrPageVariant;
  readonly level: 'session' | 'worktree';
  readonly tab?: BranchTab;
  readonly gitState?: 'level' | 'behind' | 'rebasing';
  readonly hasMoreProjects?: boolean;
  readonly isMenuOpen?: boolean;
  readonly isFolded?: boolean;
  readonly fileRail?: 'docked' | 'folded' | 'overlay';
};

const NARROW_PAGE_PX = 820;

type StatusParams = {
  readonly gitState: NonNullable<WorktreeSceneConfig['gitState']>;
};

const statusOf = ({ gitState }: StatusParams): WorktreeStatus => ({
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: 5, behind: gitState === 'behind' ? 6 : 0 },
  upstreamDistance: { kind: 'known', ahead: 2, behind: 0 },
  workingTree:
    gitState === 'rebasing'
      ? { kind: 'known', staged: 0, unstaged: 1, untracked: 0, unmerged: 1, changed: 1 }
      : { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: gitState === 'rebasing' ? 'rebase' : null,
});

const installIpc = ({ gitState }: StatusParams): void => {
  const handlers = handlersFor(BRANCH_FILES_PATCH);
  mockSceneIpc((command, payload) => {
    if (command === 'gh_run') {
      return { stdout: prPageGhStdout({ payload }), stderr: '', exitCode: 0 };
    }
    if (command === 'worktree_status') {
      return statusOf({ gitState });
    }
    if (command === 'worktree_remote_url') {
      return 'git@github.com:harborline/payments-api.git';
    }
    if (command === 'worktree_list_local_branches' || command === 'worktree_list_remote_branches') {
      return [];
    }
    return handlers[command]?.(undefined) ?? null;
  });
};

const addProjects = (): void => {
  useAppStore.setState((state) => {
    const [project] = state.projects;
    const [mount] = state.sessionProjectMounts[SESSION_ID] ?? [];
    if (project === undefined || mount === undefined) {
      return state;
    }
    const github = state.mountGithub[mount.mountId];
    if (github === undefined || github.pr === null) {
      return state;
    }
    return {
      projects: [
        ...state.projects,
        { ...project, id: LEDGER_PROJECT_ID, name: 'ledger-core' },
        { ...project, id: NOTIFY_PROJECT_ID, name: 'notify-relay' },
      ],
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [SESSION_ID]: [mount, LEDGER_MOUNT, NOTIFY_MOUNT],
      },
      mountGithub: {
        ...state.mountGithub,
        [LEDGER_MOUNT.mountId]: {
          ...github,
          mountId: LEDGER_MOUNT.mountId,
          projectId: LEDGER_PROJECT_ID,
          branch: LEDGER_MOUNT.branch,
          pr: { ...github.pr, number: 77, isDraft: false, checks: 'failure' },
        },
        [NOTIFY_MOUNT.mountId]: {
          ...github,
          mountId: NOTIFY_MOUNT.mountId,
          projectId: NOTIFY_PROJECT_ID,
          branch: NOTIFY_MOUNT.branch,
          pr: { ...github.pr, number: 54, isDraft: false, state: 'merged' },
        },
      },
    };
  });
};

const MENU_SELECTOR = '[data-worktree-open] [data-worktree-actions] button[aria-haspopup="menu"]';

const MENU_POLL_MS = 100;

const MENU_TRIES = 40;

type OpenMenuParams = {
  readonly triesLeft: number;
};

const openMenuWhenReady = ({ triesLeft }: OpenMenuParams): void => {
  const trigger = document.querySelector<HTMLElement>(MENU_SELECTOR);
  if (trigger !== null) {
    trigger.click();
    return;
  }
  if (triesLeft <= 0) {
    return;
  }
  window.setTimeout(() => openMenuWhenReady({ triesLeft: triesLeft - 1 }), MENU_POLL_MS);
};

const openMenu = (): void => {
  window.setTimeout(() => openMenuWhenReady({ triesLeft: MENU_TRIES }), MENU_POLL_MS);
};

const openFiles = (): void => {
  window.setTimeout(() => {
    const toolbar = document.querySelector<HTMLElement>('[data-slot="diff-toolbar"]');
    const files = [...(toolbar?.querySelectorAll<HTMLElement>('button') ?? [])].find((button) =>
      (button.textContent ?? '').startsWith('Files'),
    );
    files?.click();
  }, 900);
};

type Props = {
  readonly config: WorktreeSceneConfig;
  readonly children?: ReactNode;
};

export const WorktreeScene = ({ config, children = null }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const session = useCurrentSession();
  useSceneRailFold({ isFolded: config.isFolded === true });
  useSceneFileRailFold({ isFolded: config.fileRail === 'folded' });
  useEffect(() => {
    applyPrPageSeed({ variant: config.variant });
    installIpc({ gitState: config.gitState ?? 'level' });
    if (config.hasMoreProjects === true) {
      addProjects();
    }
    const state = useAppStore.getState();
    state.navigate({
      to:
        config.level === 'worktree'
          ? branchPlace({
              sessionId: SESSION_ID,
              mountPath: PR_PAGE_WORKTREE,
              tab: config.tab ?? 'pr',
            })
          : sessionPlace({ sessionId: SESSION_ID }),
    });
    setIsReady(true);
    if (config.isMenuOpen === true) {
      openMenu();
    }
    if (config.fileRail === 'overlay') {
      openFiles();
    }
  }, [config]);

  if (!isReady) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background">
      <div className="h-full w-60 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={SESSION.workspaceId}
          currentSessionId={SESSION_ID}
          place={null}
          actions={ACTIONS}
        />
      </div>
      <main
        className="flex min-w-0 flex-1 flex-col"
        style={config.fileRail === 'overlay' ? { maxWidth: NARROW_PAGE_PX } : undefined}
      >
        <SessionFrame session={session ?? SESSION}>
          {config.level === 'worktree' ? (
            <BranchPage session={session ?? SESSION} workingDir={PR_PAGE_WORKTREE} />
          ) : (
            <div className="flex flex-col gap-4 p-6">
              <h1 className="text-title text-foreground">{SESSION.goal}</h1>
              {children}
            </div>
          )}
        </SessionFrame>
      </main>
    </div>
  );
};
