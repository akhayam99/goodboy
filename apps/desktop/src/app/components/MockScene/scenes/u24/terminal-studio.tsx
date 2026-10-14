import { useEffect, useState } from 'react';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionExternalTask,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { trackTerminalInput } from '../../../../../features/terminal/commandTracker';
import { TerminalStudio } from '../../../../../features/terminal/components/TerminalStudio';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { useSceneClicks } from '../audit/useSceneClicks';
import { PageSheet } from '../PageSheet';
import { mockSceneIpc } from '../mockSceneIpc';
import { brandedId } from '../../../../../features/history/testing/brandedId';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const NOW = clock.iso({ at: '2026-10-10T09:12:00.000Z' });
const CREATED_AT = clock.ms({ at: '2026-10-10T09:00:00.000Z' });

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'mock-u24-workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'mock-u24-session-ledger' });
const OTHER_SESSION_ID = brandedId<SessionId>({ value: 'mock-u24-session-notify' });
const PAYMENTS_ID = brandedId<ProjectId>({ value: 'mock-u24-project-payments-api' });
const LEDGER_ID = brandedId<ProjectId>({ value: 'mock-u24-project-ledger-core' });
const NOTIFY_ID = brandedId<ProjectId>({ value: 'mock-u24-project-notify-relay' });

const FOLDER = '/mock/harborline';
const PAYMENTS_ROOT = `${FOLDER}/payments-api`;
const LEDGER_ROOT = `${FOLDER}/ledger-core`;
const NOTIFY_ROOT = `${FOLDER}/notify-relay`;
const PAYMENTS_TREE = `${PAYMENTS_ROOT}/.goodboy/worktrees/gb-7k2q9x`;
const LEDGER_TREE = `${LEDGER_ROOT}/.goodboy/worktrees/gb-4m8d1c`;
const NOTIFY_TREE = `${NOTIFY_ROOT}/.goodboy/worktrees/gb-2p6w0z`;

const WORKSPACE_TERMINAL = brandedId<TerminalTabId>({
  value: 'ws:mock-u24-workspace-harborline::t1',
});
const PAYMENTS_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const LEDGER_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t2` });
const PAYMENTS_SECOND_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t3` });
const NOTIFY_TERMINAL = brandedId<TerminalTabId>({ value: `${OTHER_SESSION_ID}::t1` });

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

type ProjectParams = {
  readonly id: ProjectId;
  readonly name: string;
  readonly rootPath: string;
};

const projectOf = ({ id, name, rootPath }: ProjectParams): Project => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
});

type SessionParams = {
  readonly id: SessionId;
  readonly goal: string;
};

const sessionOf = ({ id, goal }: SessionParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
});

type MountParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly worktreePath: string;
  readonly repoRoot: string;
  readonly branch: string;
};

const mountOf = ({
  id,
  sessionId,
  projectId,
  name,
  worktreePath,
  repoRoot,
  branch,
}: MountParams): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: id }),
  sessionId,
  projectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type TabParams = {
  readonly id: TerminalTabId;
  readonly owner: TerminalTab['owner'];
  readonly title: string;
  readonly cwd: string;
  readonly mountId?: string;
  readonly isExited?: boolean;
};

const tabOf = ({ id, owner, title, cwd, mountId, isExited = false }: TabParams): TerminalTab => ({
  id,
  owner,
  title,
  cwd,
  ...(mountId === undefined ? {} : { mountId: brandedId<MountId>({ value: mountId }) }),
  status: isExited ? 'exited' : 'running',
  ...(isExited ? { openError: 'The folder no longer exists' } : {}),
  createdAt: CREATED_AT,
});

const BUSY_LEDGER = [
  { id: PAYMENTS_TERMINAL, cwd: PAYMENTS_TREE, pid: 4100, foregroundPid: 4188 },
  { id: PAYMENTS_SECOND_TERMINAL, cwd: PAYMENTS_TREE, pid: 4110, foregroundPid: 4110 },
  { id: WORKSPACE_TERMINAL, cwd: FOLDER, pid: 4000, foregroundPid: 4000 },
];

const DIFF_BY_TREE: Readonly<
  Record<string, { readonly additions: number; readonly deletions: number }>
> = {
  [PAYMENTS_TREE]: { additions: 47, deletions: 12 },
  [LEDGER_TREE]: { additions: 18, deletions: 3 },
  [NOTIFY_TREE]: { additions: 41, deletions: 6 },
};

const emptyChangedFiles = {
  paths: [],
  entries: [],
  additions: 0,
  deletions: 0,
  numstat: '',
};

type PayloadParams = {
  readonly payload: unknown;
};

const worktreePathOf = ({ payload }: PayloadParams): string => {
  if (typeof payload !== 'object' || payload === null || !('worktreePath' in payload)) {
    return '';
  }
  return typeof payload.worktreePath === 'string' ? payload.worktreePath : '';
};

const sceneAnswer = (command: string, payload: unknown): unknown => {
  if (command === 'terminal_list_live') {
    return BUSY_LEDGER;
  }
  if (command === 'worktree_changed_files') {
    const path = worktreePathOf({ payload });
    return { ...emptyChangedFiles, ...(DIFF_BY_TREE[path] ?? {}) };
  }
  return null;
};

type TaskParams = {
  readonly sessionId: SessionId;
  readonly identifier: string;
  readonly title: string;
};

const taskOf = ({ sessionId, identifier, title }: TaskParams): SessionExternalTask => ({
  sessionId,
  scope: 'session',
  provider: 'linear',
  externalId: `mock-u24-${identifier.toLowerCase()}`,
  identifier,
  url: `https://linear.example/harborline/issue/${identifier}`,
  title,
  createdAt: NOW,
});

type RecordParams = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly worktreePath: string;
  readonly branch: string;
};

const recordOf = ({ sessionId, projectId, name, worktreePath, branch }: RecordParams) => ({
  id: `mock-u24-worktree-${name}`,
  sessionId,
  worktreePath,
  branch,
  parallelIndex: 0,
  projectId,
  mountName: name,
  repoSlug: `harborline/${name}`,
  createdAt: CREATED_AT,
});

type SeedParams = {
  readonly hasTerminals: boolean;
};

const seed = ({ hasTerminals }: SeedParams): void => {
  trackTerminalInput({ terminalId: PAYMENTS_TERMINAL, data: 'pnpm dev\r' });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [
      projectOf({ id: PAYMENTS_ID, name: 'payments-api', rootPath: PAYMENTS_ROOT }),
      projectOf({ id: LEDGER_ID, name: 'ledger-core', rootPath: LEDGER_ROOT }),
      projectOf({ id: NOTIFY_ID, name: 'notify-relay', rootPath: NOTIFY_ROOT }),
    ],
    sessions: [
      sessionOf({ id: SESSION_ID, goal: 'Round settlement totals to minor units' }),
      sessionOf({ id: OTHER_SESSION_ID, goal: 'Back off failed notification retries' }),
    ],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: {
      [SESSION_ID]: [
        mountOf({
          id: 'mock-u24-mount-payments',
          sessionId: SESSION_ID,
          projectId: PAYMENTS_ID,
          name: 'payments-api',
          worktreePath: PAYMENTS_TREE,
          repoRoot: PAYMENTS_ROOT,
          branch: 'hl/fix-duplicate-credit',
        }),
        mountOf({
          id: 'mock-u24-mount-ledger',
          sessionId: SESSION_ID,
          projectId: LEDGER_ID,
          name: 'ledger-core',
          worktreePath: LEDGER_TREE,
          repoRoot: LEDGER_ROOT,
          branch: 'hl/ledger-rounding',
        }),
      ],
      [OTHER_SESSION_ID]: [
        mountOf({
          id: 'mock-u24-mount-notify',
          sessionId: OTHER_SESSION_ID,
          projectId: NOTIFY_ID,
          name: 'notify-relay',
          worktreePath: NOTIFY_TREE,
          repoRoot: NOTIFY_ROOT,
          branch: 'hl/retry-backoff',
        }),
      ],
    },
    sessionExternalTasks: {
      [SESSION_ID]: [
        taskOf({ sessionId: SESSION_ID, identifier: 'HBL-412', title: 'Round settlement totals' }),
      ],
      [OTHER_SESSION_ID]: [],
    },
    sessionWorktreeRecords: {
      [SESSION_ID]: [
        recordOf({
          sessionId: SESSION_ID,
          projectId: PAYMENTS_ID,
          name: 'payments-api',
          worktreePath: PAYMENTS_TREE,
          branch: 'hl/fix-duplicate-credit',
        }),
        recordOf({
          sessionId: SESSION_ID,
          projectId: LEDGER_ID,
          name: 'ledger-core',
          worktreePath: LEDGER_TREE,
          branch: 'hl/ledger-rounding',
        }),
      ],
      [OTHER_SESSION_ID]: [
        recordOf({
          sessionId: OTHER_SESSION_ID,
          projectId: NOTIFY_ID,
          name: 'notify-relay',
          worktreePath: NOTIFY_TREE,
          branch: 'hl/retry-backoff',
        }),
      ],
    },
    terminalFolderOverrides: {},
    terminalNames: {},
    terminalTabs: hasTerminals
      ? {
          [`ws:${WORKSPACE_ID}`]: [
            tabOf({
              id: WORKSPACE_TERMINAL,
              owner: { kind: 'workspace', workspaceId: WORKSPACE_ID },
              title: 'shell',
              cwd: FOLDER,
            }),
          ],
          [SESSION_ID]: [
            tabOf({
              id: PAYMENTS_TERMINAL,
              owner: { kind: 'session', sessionId: SESSION_ID },
              title: 'dev server',
              cwd: PAYMENTS_TREE,
              mountId: 'mock-u24-mount-payments',
            }),
            tabOf({
              id: LEDGER_TERMINAL,
              owner: { kind: 'session', sessionId: SESSION_ID },
              title: 'shell',
              cwd: LEDGER_TREE,
              mountId: 'mock-u24-mount-ledger',
              isExited: true,
            }),
            tabOf({
              id: PAYMENTS_SECOND_TERMINAL,
              owner: { kind: 'session', sessionId: SESSION_ID },
              title: 'shell',
              cwd: PAYMENTS_TREE,
              mountId: 'mock-u24-mount-payments',
            }),
          ],
          [OTHER_SESSION_ID]: [
            tabOf({
              id: NOTIFY_TERMINAL,
              owner: { kind: 'session', sessionId: OTHER_SESSION_ID },
              title: 'shell',
              cwd: NOTIFY_TREE,
              mountId: 'mock-u24-mount-notify',
            }),
          ],
        }
      : {},
    activeTerminalTab: hasTerminals ? { [SESSION_ID]: PAYMENTS_TERMINAL } : {},
    terminalWorktreeActive: hasTerminals
      ? { [`${SESSION_ID}#m:mock-u24-mount-payments`]: PAYMENTS_TERMINAL }
      : {},
    terminalSelection: null,
  });
};

const NOOP = () => undefined;

type Variant = 'list' | 'newmenu' | 'closeconfirm' | 'empty';

type Props = {
  readonly variant: Variant;
};

const CLICK_MS = 300;

const clickLabelOf = ({ variant }: Props): ReadonlyArray<string> => {
  switch (variant) {
    case 'newmenu':
      return ['New terminal in'];
    case 'closeconfirm':
      return ['Close dev server'];
    case 'list':
    case 'empty':
      return [];
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
};

const TerminalStudioScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const studio = useAppStore((state) => state.appStudio);

  useEffect(() => {
    mockSceneIpc(sceneAnswer);
    seed({ hasTerminals: variant !== 'empty' });
    useAppStore.getState().openStudio({
      studio: {
        kind: 'terminal',
        terminalId: variant === 'empty' ? null : PAYMENTS_TERMINAL,
        sessionId: SESSION_ID,
        worktree: variant === 'empty' ? null : `${SESSION_ID}#m:mock-u24-mount-payments`,
      },
    });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: clickLabelOf({ variant }),
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <TerminalStudio
          workspaceId={WORKSPACE_ID}
          terminalId={studio?.kind === 'terminal' ? studio.terminalId : null}
          sessionId={studio?.kind === 'terminal' ? studio.sessionId : SESSION_ID}
          worktree={studio?.kind === 'terminal' ? (studio.worktree ?? null) : null}
          onClose={NOOP}
        />
      </PageSheet>
    </main>
  );
};

export const U24_TERMINAL_STUDIO_SCENES = {
  'terminal-studio': () => <TerminalStudioScene variant="list" />,
  'terminal-studio-newmenu': () => <TerminalStudioScene variant="newmenu" />,
  'terminal-studio-closeconfirm': () => <TerminalStudioScene variant="closeconfirm" />,
  'terminal-studio-empty': () => <TerminalStudioScene variant="empty" />,
};
