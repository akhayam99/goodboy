// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === 'linear_fetch_issue_comments') {
      return [
        {
          id: 'cas-231-c1',
          body: 'Reproduced on staging with a gift card plus a card.',
          createdAt: '2026-08-21T10:00:00.000Z',
          parent: null,
          user: { name: 'Robin Vale', avatarUrl: null },
        },
      ];
    }
    return new Promise<never>(() => undefined);
  }),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ProviderId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { sessionPlace } from '../../store/slices/navigation/place';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { ToastProvider } from '../../app/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import {
  SETTINGS_WORKSPACE,
  seedSettingsBase,
} from '../../app/components/MockScene/scenes/audit/settingsSeed';
import { InboxDetail } from '../../features/inbox/components/InboxStudio/InboxDetail';
import type { InboxProvider, InboxRecord } from '../../features/inbox/types';
import { StageBoard } from '../../features/workspace/components/StageBoard';
import { SettingsStudio } from '../../features/settings/components/SettingsStudio';
import { SessionDraftPane } from '../../features/session/components/SessionDraftPane';
import { WorkspaceSwitcher } from '../../features/workspace/components/WorkspaceSwitcher';
import { ContextDrawer } from '../../features/session/components/ContextDrawer';
import { PullRequestPage } from '../../features/review/components/PullRequestPage';
import { CONTEXT_TAB_LABEL } from '../../features/session/components/ContextDrawer/contextTabs';
import type { SettingsFocus } from '../../features/settings/components/SettingsStudio/types';

const LINKED_PR_URL = 'https://example.invalid/cascade/pull/231';

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

const GITHUB_RECORD: InboxRecord = {
  key: 'github:issue:187',
  provider: 'github',
  kind: 'issue',
  identifier: '#187',
  title: 'The admin sessions table loads every row at once',
  state: 'open',
  stateLabel: 'Open',
  updatedAt: '2026-08-21T09:00:00.000Z',
  url: 'https://example.invalid/cascade/issues/187',
  context: 'cascade/web-console',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 187,
      title: 'The admin sessions table loads every row at once',
      body: 'Paginate the table so the first paint stays fast.',
      url: 'https://example.invalid/cascade/issues/187',
      state: 'OPEN',
      labels: [],
      updatedAt: '2026-08-21T09:00:00.000Z',
    },
    sessionId: null,
  },
};

const LINEAR_RECORD: InboxRecord = {
  key: 'linear:issue:cas-231',
  provider: 'linear',
  kind: 'issue',
  identifier: 'CAS-231',
  title: 'Refunds on split payments leave the second charge captured',
  state: 'open',
  stateLabel: 'Todo',
  updatedAt: '2026-08-21T09:30:00.000Z',
  url: 'https://example.invalid/linear/CAS-231',
  context: 'Payments',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: 'cas-231',
      identifier: 'CAS-231',
      title: 'Refunds on split payments leave the second charge captured',
      description: 'One refund request should refund every charge on the order.',
      url: 'https://example.invalid/linear/CAS-231',
      state: { name: 'Todo', type: 'unstarted' },
      team: { key: 'CAS' },
      priority: 2,
      priorityLabel: 'High',
      assignee: { name: 'Robin Vale' },
      project: { name: 'Payments' },
      labels: { nodes: [{ name: 'refunds', color: '#5e6ad2' }] },
      updatedAt: '2026-08-21T09:30:00.000Z',
      attachments: {
        nodes: [
          {
            id: 'cas-231-pr',
            title: 'Add pagination to the admin sessions table',
            url: LINKED_PR_URL,
            sourceType: 'github',
            metadata: { status: 'open' },
          },
        ],
      },
    },
    sessionId: null,
  },
};

const JIRA_RECORD: InboxRecord = {
  key: 'jira:issue:fin-91',
  provider: 'jira',
  kind: 'issue',
  identifier: 'FIN-91',
  title: 'Reconcile the nightly settlement export before the Monday close',
  state: 'active',
  stateLabel: 'In Progress',
  updatedAt: '2026-08-21T08:00:00.000Z',
  url: 'https://example.invalid/jira/FIN-91',
  context: 'Task · In Progress',
  payload: {
    provider: 'jira',
    kind: 'issue',
    issue: {
      id: 'fin-91',
      key: 'FIN-91',
      summary: 'Reconcile the nightly settlement export before the Monday close',
      description: 'The export drifts by a few cents against ledger-core.',
      status: 'In Progress',
      statusCategory: 'indeterminate',
      issueType: 'Task',
      priority: 'High',
      assignee: {
        accountId: 'priya',
        displayName: 'Priya Nand',
        emailAddress: null,
        avatarUrls: null,
        active: true,
      },
      reporter: {
        accountId: 'jules',
        displayName: 'Jules Marin',
        emailAddress: null,
        avatarUrls: null,
        active: true,
      },
      labels: ['finance'],
      created: '2026-08-18T08:00:00.000Z',
      updated: '2026-08-21T08:00:00.000Z',
      url: 'https://example.invalid/jira/FIN-91',
    },
    sessionId: null,
  },
};

const SENTRY_RECORD: InboxRecord = {
  key: 'sentry:error:core-api-7k1',
  provider: 'sentry',
  kind: 'error',
  identifier: 'CORE-API-7K1',
  title: 'DuplicateChargeError: charge already captured for order',
  state: 'alert',
  stateLabel: 'Unresolved',
  updatedAt: '2026-08-21T09:50:00.000Z',
  url: 'https://example.invalid/sentry/CORE-API-7K1',
  context: 'core-api',
  payload: {
    provider: 'sentry',
    kind: 'error',
    issue: {
      id: 'core-api-7k1',
      shortId: 'CORE-API-7K1',
      title: 'DuplicateChargeError: charge already captured for order',
      culprit: 'payments.capture',
      level: 'error',
      status: 'unresolved',
      count: '14',
      userCount: 9,
      firstSeen: '2026-08-20T09:50:00.000Z',
      lastSeen: '2026-08-21T09:50:00.000Z',
      permalink: 'https://example.invalid/sentry/CORE-API-7K1',
      metadata: null,
    },
    sessionId: null,
  },
};

let useAppStore: StoryStore;
let consoleErrors: Array<string> = [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  consoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type MountParams = {
  readonly ui: ReactNode;
};

const mountSurface = async ({ ui }: MountParams): Promise<void> => {
  render(<ToastProvider>{ui}</ToastProvider>);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const expectNoRenderLoop = (): void => {
  expect(consoleErrors.filter((line) => line.includes('Maximum update depth'))).toEqual([]);
};

describe('primary surfaces mount on real store selectors', () => {
  it.each([
    ['github', GITHUB_RECORD],
    ['linear', LINEAR_RECORD],
    ['jira', JIRA_RECORD],
    ['sentry', SENTRY_RECORD],
  ])('opens a %s item in the inbox detail pane', async (_provider, record) => {
    seedBoardScene();

    await mountSurface({
      ui: (
        <InboxDetail
          record={record}
          workspaceId={WORKSPACE_ID}
          rootPath="/mock/cascade/core-api"
          errors={NO_ERRORS}
          onRefresh={() => undefined}
          onClose={() => undefined}
          onDeselect={() => undefined}
          launchFocusRequest={0}
        />
      ),
    });

    expect(screen.getAllByText(record.title).length).toBeGreaterThan(0);
    expectNoRenderLoop();
  });

  it('shows the linked pull request chip on a linear item a session tracks', async () => {
    seedBoardScene();

    await mountSurface({
      ui: (
        <InboxDetail
          record={LINEAR_RECORD}
          workspaceId={WORKSPACE_ID}
          rootPath="/mock/cascade/core-api"
          errors={NO_ERRORS}
          onRefresh={() => undefined}
          onClose={() => undefined}
          onDeselect={() => undefined}
          launchFocusRequest={0}
        />
      ),
    });

    screen.getByRole('button', { name: /PR #231/ });
    await screen.findByText('Reproduced on staging with a gift card plus a card.');
    expectNoRenderLoop();
  });

  it('opens the session overview', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });

    await mountSurface({ ui: <KeepAliveWorkSurface sessionId={sessionId} isActive /> });

    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    expect(screen.getByTestId('context-chip')).toBeDefined();
    expectNoRenderLoop();
  });

  it('opens the session diff', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });

    await mountSurface({ ui: <KeepAliveWorkSurface sessionId={sessionId} isActive /> });
    await act(async () => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'files' }) });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.getByRole('heading', { name: 'Diff' })).toBeDefined();
    expect(screen.queryByText('No worktree for this session')).toBeNull();
    expectNoRenderLoop();
  });

  it('opens the pull request page', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore, hasPr: true });
    const state = useAppStore.getState();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const pr = state.sessionGithub[sessionId]?.pr ?? null;
    if (session === undefined || pr === null) {
      throw new Error('the board seed has no session with a tracked pull request');
    }

    await mountSurface({ ui: <PullRequestPage session={session} /> });

    expect(screen.getAllByText(pr.title).length).toBeGreaterThan(0);
    expectNoRenderLoop();
  });

  it('opens the new session draft', async () => {
    seedBoardScene();

    await mountSurface({ ui: <SessionDraftPane workspaceId={WORKSPACE_ID} /> });

    expect(screen.getByRole('tablist', { name: 'How do you want to start?' })).toBeDefined();
    expectNoRenderLoop();
  });

  it.each(['goal', 'decisions', 'summary'] as const)(
    'opens the %s tab of the context drawer',
    async (tab) => {
      const sessionId = seedSessionWithMounts({ useAppStore });

      await mountSurface({
        ui: (
          <ContextDrawer sessionId={sessionId} tab={tab} view="current" onClose={() => undefined} />
        ),
      });

      expect(
        screen.getByRole('tab', { name: CONTEXT_TAB_LABEL[tab] }).getAttribute('aria-selected'),
      ).toBe('true');
      expectNoRenderLoop();
    },
  );

  it('opens the workspace popover', async () => {
    seedBoardScene();

    await mountSurface({ ui: <WorkspaceSwitcher onClose={() => undefined} /> });

    expect(screen.getAllByText('Harborline').length).toBeGreaterThan(0);
    expectNoRenderLoop();
  });

  it('opens the board', async () => {
    seedBoardScene();
    const sessions = useAppStore.getState().sessions;

    await mountSurface({ ui: <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} /> });

    expect(screen.getAllByText(sessions[0]?.goal ?? '').length).toBeGreaterThan(0);
    expectNoRenderLoop();
  });

  it.each([
    ['app settings', { scope: 'app' }, 'Settings'],
    ['workspace settings with its rail', { scope: 'workspace' }, 'Projects'],
    ['the providers page', { scope: 'providers' }, 'Providers'],
    ['a provider page', { scope: 'providers', provider: 'anthropic' as ProviderId }, 'Claude'],
  ] satisfies ReadonlyArray<readonly [string, SettingsFocus, string]>)(
    'opens %s',
    async (_name, focus, text) => {
      seedSettingsBase();

      await mountSurface({
        ui: (
          <SettingsStudio
            currentWorkspace={SETTINGS_WORKSPACE}
            focus={focus}
            onScopeChange={() => undefined}
            onClose={() => undefined}
          />
        ),
      });

      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      expectNoRenderLoop();
    },
  );
});
