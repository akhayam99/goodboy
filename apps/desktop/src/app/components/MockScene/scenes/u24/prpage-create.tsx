import { useEffect, useRef, useState } from 'react';
import { PageColumn, ScrollFade } from '@goodboy/ui';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { CreatePrPanel } from '../../../../../features/integrations/github/components/PullRequest/CreatePrPanel';
import { CreateMrForm } from '../../../../../features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm';
import { useAppStore } from '../../../../../store';
import type { CreatePrInput } from '../../../../../store/slices/github/createPrForSession';
import type { ScribeWork } from '../../../../../store/slices/scribe/types';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

const clock = sceneClock({ anchor: '2026-10-11T09:12:00.000Z' });

const WORKSPACE_ID: WorkspaceId = JSON.parse(
  JSON.stringify('mock-u24-workspace-harborline-create'),
);
const SESSION_ID: SessionId = JSON.parse(JSON.stringify('mock-u24-session-create'));
const PROJECT_ID: ProjectId = JSON.parse(JSON.stringify('mock-u24-project-ledger-core-create'));
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mock-u24-mount-credit-create'));
const NOW = clock.iso({ at: '2026-10-11T09:12:00.000Z' });

const ROOT = '~/code/harborline/ledger-core';
const WORKTREE = `${ROOT}-credit`;
const BRANCH = 'hl/fix-duplicate-credit';
const GOAL = 'Fix duplicate credit on settlement retries';

const PRPAGE_CREATE_STATES = ['empty', 'typing', 'writing', 'ready', 'creating', 'failed'] as const;

type PrpageCreateState = (typeof PRPAGE_CREATE_STATES)[number];

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

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: ROOT,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: GOAL,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: PROJECT_ID,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'ledger-core',
  repoSlug: 'harborline/ledger-core',
  repoRoot: ROOT,
  isAttached: true,
  diskState: 'present',
  revision: 2,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECT_MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  repoRoot: ROOT,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  diskState: 'present',
  revision: 2,
  sessionId: SESSION_ID,
  isAttached: true,
};

const STATUS: WorktreeStatus = {
  branch: BRANCH,
  head: 'c0ffee123456',
  headSubject: GOAL,
  upstream: `origin/${BRANCH}`,
  upstreamDistance: { kind: 'known', ahead: 2, behind: 0 },
  mainDistance: { kind: 'known', ahead: 7, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const CLAUDE: ProviderDisplayInfo = {
  id: 'anthropic',
  binary: 'claude',
  capabilities: { models: [] },
  connection: 'connected',
  version: '1.0.0',
  identity: 'mock-team',
  label: 'Claude',
  error: null,
  docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
};

const LINKED_ISSUE: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: '204',
  identifier: 'HL-204',
  url: 'https://github.com/harborline/ledger-core/issues/204',
  title: 'Retried settlements credit the account twice',
  createdAt: NOW,
};

const TYPED_BODY =
  'Settlement retries re-posted the credit when the first attempt timed out after the ledger write.';

const WRITTEN_TITLE = 'Stop duplicate credits when a settlement retries';
const WRITTEN_BODY = [
  'A retried settlement posted its credit twice when the first attempt timed out after the ledger write.',
  '',
  '- key each credit by the settlement id',
  '- skip the post when the key is already in the ledger',
  '- cover the retry path with a test',
].join('\n');

const SCRIBE_BASE: ScribeWork = {
  key: `pr:${MOUNT_ID}`,
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  agentId: null,
  task: {
    kind: 'pr',
    closedPrNumber: null,
    references: [],
    isDraft: false,
    base: null,
    isTextOnly: true,
  },
  status: 'writing',
  output: null,
  error: null,
  pullRequest: null,
  updatedAt: clock.ms({ at: '2026-10-11T09:11:53.000Z' }),
};

type StateParams = {
  readonly state: PrpageCreateState;
};

const jobOf = ({ state }: StateParams): ScribeWork | null => {
  if (state === 'writing') {
    return SCRIBE_BASE;
  }
  if (state === 'ready') {
    return {
      ...SCRIBE_BASE,
      status: 'ready',
      output: {
        prTitle: WRITTEN_TITLE,
        prBody: WRITTEN_BODY,
        commitMessages: [],
        changelogEntry: '- Fix duplicate credits when a settlement retries (HL-204)',
      },
      updatedAt: clock.ms({ at: '2026-10-11T09:12:00.000Z' }),
    };
  }
  return null;
};

type AnswerParams = {
  readonly command: string;
  readonly payload: unknown;
};

const answerOf = ({ command, payload }: AnswerParams): unknown => {
  if (command === 'worktree_status') {
    return STATUS;
  }
  if (command !== 'gh_run') {
    return null;
  }
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  const line = Array.isArray(args) ? args.join(' ') : '';
  if (line.includes('defaultBranchRef')) {
    return { stdout: 'main', stderr: '', exitCode: 0 };
  }
  if (line.includes('branches')) {
    return { stdout: 'main\nrelease/2026.10\nstaging', stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: '', exitCode: 0 };
};

const NEVER = (): Promise<never> => new Promise<never>(() => undefined);

const seed = ({ state }: StateParams): void => {
  const job = jobOf({ state });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PROJECT],
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    providers: [CLAUDE],
    sessionMounts: { [SESSION_ID]: [MOUNT_VIEW] },
    sessionProjectMounts: { [SESSION_ID]: [PROJECT_MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionBranches: { [SESSION_ID]: BRANCH },
    sessionWorktrees: { [SESSION_ID]: [WORKTREE] },
    sessionExternalTasks: { [SESSION_ID]: [LINKED_ISSUE] },
    mountGithub: {},
    mountGitlabMr: {},
    mountBitbucketPr: {},
    scribeWork: job === null ? {} : { [SCRIBE_BASE.key]: job },
    ...(state === 'creating'
      ? {
          createPrForSession: async ({ onPushed }: CreatePrInput) => {
            onPushed?.();
            return NEVER();
          },
        }
      : {}),
    ...(state === 'failed'
      ? {
          createPrForSession: async () => {
            throw new Error(`Couldn't push ${BRANCH}: remote: Permission denied to harborline-bot`);
          },
        }
      : {}),
  });
};

const stateOfLocation = (): PrpageCreateState => {
  const value = new URLSearchParams(window.location.search).get('state');
  return PRPAGE_CREATE_STATES.find((candidate) => candidate === value) ?? 'empty';
};

type SceneProps = {
  readonly host: 'github' | 'gitlab';
};

const CreateScene = ({ host }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const state = stateOfLocation();

  useEffect(() => {
    mockSceneIpc((command, payload) => answerOf({ command, payload }));
    seed({ state });
    setIsReady(true);
  }, [state]);

  useEffect(() => {
    if (!isReady || (state !== 'creating' && state !== 'failed')) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const buttons = frame.current?.querySelectorAll<HTMLButtonElement>(
        '[data-slot="create-actions"] button',
      );
      buttons?.[buttons.length - 1]?.click();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }

  const hasBody = state === 'typing' || state === 'creating' || state === 'failed';

  return (
    <ScrollFade className="h-screen bg-background py-8 text-foreground">
      <PageColumn width="column">
        <div ref={frame}>
          {host === 'github' ? (
            <CreatePrPanel
              sessionId={SESSION_ID}
              defaultTitle={GOAL}
              {...(hasBody ? { defaultBody: TYPED_BODY } : {})}
              onCreated={() => undefined}
            />
          ) : (
            <CreateMrForm sessionId={SESSION_ID} onCreated={() => undefined} />
          )}
        </div>
      </PageColumn>
    </ScrollFade>
  );
};

export const U24_PRPAGE_CREATE_SCENES = {
  'branch-create': () => <CreateScene host="github" />,
  'branch-create-gitlab': () => <CreateScene host="gitlab" />,
};
