import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  IsoDateTime,
  Session,
  SessionId,
  StarredIssue,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { IssueBriefEntry } from '../../../store/slices/issue-briefs/types';
import {
  type BridgeArgs,
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  clickButton,
  settle,
  useAppStore,
  visible,
} from './harness';

const STARRED_ID = 'start-paths-issue-415';

let newSessionId: SessionId | null = null;

let bootedSessionId: SessionId | null = null;

const boardSessionId = (): SessionId | null => bootedSessionId;

const NEW_RUN_ID = 'start-paths-run' as WorkflowRunId;

const BRIEF_KEY = `linear:${STARRED_ID}`;

const LOADING: IssueBriefEntry = {
  status: 'loading',
  signature: 'start-paths',
  route: { providerId: 'anthropic', model: 'haiku-4.5' },
};

let clicks = 0;

const counted = (element: HTMLElement): void => {
  clicks += 1;
  fireEvent.click(element);
};

const starredIssue = (): StarredIssue => {
  const workspaceId = useAppStore.getState().currentWorkspaceId as WorkspaceId;
  return {
    workspaceId,
    provider: 'linear',
    externalId: STARRED_ID,
    identifier: 'HBL-415',
    container: 'HBL',
    title: 'Retried webhooks post a second credit',
    url: 'https://linear.example.test/HBL-415',
    state: 'open',
    stateLabel: 'Todo',
    starredAt: '2026-09-01T10:00:00.000Z' as StarredIssue['starredAt'],
    refreshedAt: '2026-09-01T10:00:00.000Z' as StarredIssue['refreshedAt'],
  };
};

type StartCalls = {
  readonly briefs: Array<unknown>;
  readonly sessions: Array<Readonly<Record<string, unknown>>>;
  readonly runs: Array<{ readonly sessionId: string; readonly workflowId: string }>;
  readonly agents: Array<Readonly<Record<string, unknown>>>;
};

export const startCalls: StartCalls = { briefs: [], sessions: [], runs: [], agents: [] };

const installFakes = ({ sessionId }: Ctx): void => {
  bootedSessionId = sessionId;
  newSessionId = null;
  startCalls.briefs.length = 0;
  startCalls.sessions.length = 0;
  startCalls.runs.length = 0;
  startCalls.agents.length = 0;
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  useAppStore.setState({
    starredIssues: { [workspaceId]: [starredIssue()] },
    requestIssueBrief: async (params) => {
      startCalls.briefs.push(params);
      useAppStore.setState((current) => ({
        issueBriefs: { ...current.issueBriefs, [BRIEF_KEY]: LOADING },
      }));
    },
    createSession: async (input) => {
      startCalls.sessions.push(input);
      const taken = useAppStore
        .getState()
        .sessions.find(
          (candidate) =>
            candidate.workspaceId === input.workspaceId && candidate.id !== boardSessionId(),
        );
      if (taken === undefined) {
        throw new Error('the board seed has no second session in the workspace');
      }
      const session: Session = { ...taken, goal: input.title ?? input.goal, workflowRuns: [] };
      useAppStore.setState((current) => ({
        sessions: current.sessions.map((candidate) =>
          candidate.id === session.id ? session : candidate,
        ),
        currentSessionId: session.id,
      }));
      newSessionId = session.id;
      return { session };
    },
    savePhaseTemplate: async (template) => {
      const now = '2026-10-07T09:00:00.000Z' as IsoDateTime;
      const saved: Workflow = {
        ...template,
        createdAt: now,
        updatedAt: now,
      } as Workflow;
      return saved;
    },
    generateWorkflowTitle: async () => undefined,
    attachWorkflowToSession: async (sessionId, workflowId) => {
      startCalls.runs.push({ sessionId, workflowId });
      const run: WorkflowRun = {
        id: NEW_RUN_ID,
        workflowId: workflowId as WorkflowId,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      };
      useAppStore.setState((current) => ({
        sessions: current.sessions.map((candidate) =>
          candidate.id === sessionId
            ? { ...candidate, workflowRuns: [...candidate.workflowRuns, run] }
            : candidate,
        ),
      }));
    },
    spawnAgent: async (sessionId, args) => {
      startCalls.agents.push({ sessionId, ...args });
      return 'start-paths-agent' as never;
    },
  });
};

const inboxRowButton = (identifier: string): HTMLElement => {
  const row = Array.from(document.querySelectorAll<HTMLElement>('[data-inbox-key]')).find(
    (candidate) => candidate.textContent?.includes(identifier),
  );
  const button = row?.querySelector('button') ?? null;
  if (button === null) {
    throw new Error(`the inbox lists no ${identifier}`);
  }
  return button;
};

const openTasksAndStart = async (ctx: Ctx): Promise<void> => {
  installFakes(ctx);
  clicks = 0;
  await clickButton('Tasks');
  await visible('region', 'Starred');
  counted(inboxRowButton('HBL-415'));
  await settle();
  counted(await screen.findByRole('button', { name: /^Start from HBL-415/ }, WAIT));
  await settle(6);
};

const draftBlock = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Brief from HBL-415' }, WAIT);

const toastTitles = (title: string): ReadonlyArray<HTMLElement> => screen.queryAllByText(title);

const REVIEW_REQUESTED_PR = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: 'nadia-p/single-credit',
  reviewDecision: null,
  statusCheckRollup: [],
  updatedAt: '2026-10-07T09:00:00.000Z',
  body: 'One credit per processor event.',
  autoMergeRequest: null,
  headRefOid: null,
  mergedAt: null,
  author: { login: 'nadia-p' },
};

type GhArgs = { readonly args?: ReadonlyArray<string> };

const ghAnswer = (argv: ReadonlyArray<string>): string => {
  if (argv[0] === 'repo' && argv[1] === 'view') {
    return 'harborline/payments-api\n';
  }
  if (argv[0] === 'pr' && argv[1] === 'list') {
    const search = argv[argv.indexOf('--search') + 1] ?? '';
    return JSON.stringify(search.startsWith('review-requested') ? [REVIEW_REQUESTED_PR] : []);
  }
  return '[]';
};

type Bridge = (command: string, args?: BridgeArgs) => Promise<unknown>;

export const startBridge = (
  command: string,
  args: BridgeArgs | undefined,
  base: Bridge,
): Promise<unknown> => {
  if (command === 'gh_run') {
    const argv = (args as GhArgs | undefined)?.args ?? [];
    return Promise.resolve({ stdout: ghAnswer(argv), stderr: '', exitCode: 0 });
  }
  return base(command, args);
};

export const START_PATHS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Tasks issue: Start opens the New session draft with the issue picked and its brief loading',
    covers: ['navigate'],
    open: openTasksAndStart,
    lands: async () => {
      await draftBlock();
      const workspaceId = useAppStore.getState().currentWorkspaceId as WorkspaceId;
      const draft = useAppStore.getState().sessionDrafts[workspaceId];
      expect(draft?.choice).toBe('task');
      expect(draft?.pickedIssue?.identifier).toBe('HBL-415');
      expect(startCalls.briefs).toHaveLength(1);
      expect(screen.getByText('Writing a brief')).toBeDefined();
      expect(startCalls.sessions).toHaveLength(0);
      expect(screen.queryByRole('dialog', { name: 'Start a session' })).toBeNull();
    },
  },
  {
    name: 'The draft shows one block: the brief title, how to work on it and the one start',
    covers: ['navigate'],
    open: openTasksAndStart,
    lands: async () => {
      const block = await draftBlock();
      expect(within(block).getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
        'value',
        'Retried webhooks post a second credit',
      );
      expect(screen.getByRole('tablist', { name: 'How to work on it' })).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Start from HBL-415' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Search issues' })).toBeNull();
    },
  },
  {
    name: 'Start from the draft creates the session and the run, with one Follow toast and three clicks',
    covers: ['navigate', 'toast:follow'],
    open: async (ctx) => {
      await openTasksAndStart(ctx);
      await draftBlock();
      counted(await screen.findByRole('button', { name: 'Start from HBL-415' }, WAIT));
      await settle(6);
    },
    lands: async () => {
      await waitFor(() => expect(startCalls.runs).toHaveLength(1), WAIT);
      expect(startCalls.sessions).toHaveLength(1);
      expect(startCalls.sessions[0]).toMatchObject({
        title: 'Retried webhooks post a second credit',
        externalTasks: [expect.objectContaining({ identifier: 'HBL-415', provider: 'linear' })],
      });
      expect(startCalls.runs[0]?.sessionId).toBe(newSessionId);
      await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(newSessionId), WAIT);
      expect(await screen.findAllByText('Run started', {}, WAIT)).toHaveLength(1);
      expect(toastTitles('Session started')).toHaveLength(0);
      expect(clicks).toBeLessThanOrEqual(3);
    },
  },
  {
    name: 'Tasks pull request waiting on you: Review pull request starts a PR reviewer and lands on the Pull request tab',
    covers: ['navigate', 'toast:follow'],
    open: async (ctx) => {
      installFakes(ctx);
      clicks = 0;
      await clickButton('Tasks');
      await waitFor(() => inboxRowButton('#318'), WAIT);
      counted(inboxRowButton('#318'));
      await settle();
      counted(await screen.findByRole('button', { name: 'Review pull request' }, WAIT));
      await settle(6);
    },
    lands: async () => {
      await waitFor(() => expect(startCalls.agents).toHaveLength(1), WAIT);
      expect(startCalls.agents[0]).toMatchObject({
        sessionId: newSessionId,
        kindOverride: 'pr-reviewer',
        initialPrompt: '',
      });
      expect(startCalls.sessions[0]).toMatchObject({
        title: 'Review #318: Stop retried webhooks posting a second credit',
        existingBranch: 'nadia-p/single-credit',
        fallbackRef: 'pull/318/head',
        externalTasks: [expect.objectContaining({ identifier: '#318', provider: 'github' })],
      });
      if (newSessionId === null) {
        throw new Error('the review did not create a session');
      }
      await branchTab('pr')({ sessionId: newSessionId });
      expect(await screen.findAllByText('Review started', {}, WAIT)).toHaveLength(1);
      expect(clicks).toBeLessThanOrEqual(2);
    },
  },
];
