// @vitest-environment happy-dom

const bridge = vi.hoisted(() => ({
  routes: {} as Record<string, (args: Record<string, unknown>) => unknown>,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string, args: Record<string, unknown> = {}) => {
    if (command === 'db_execute') {
      return { rowsAffected: 1 };
    }
    if (command === 'db_select') {
      return [];
    }
    const route = bridge.routes[command];
    if (route == null) {
      throw new Error(`no route for ${command}`);
    }
    return route(args);
  }),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../app/components/Toast';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import { attachLinkedSession } from '../../features/inbox/attachLinkedSession';
import { InboxDetail } from '../../features/inbox/components/InboxStudio/InboxDetail';
import { InboxStudio } from '../../features/inbox/components/InboxStudio';
import type { InboxProvider, InboxRecord } from '../../features/inbox/types';
import { useInboxLinkedSessions } from '../../features/inbox/useInboxLinkedSessions';
import { LinkIssueAction } from '../../features/session/components/SessionOverviewPane/LinkIssueAction';
import { LinkedWorkChips } from '../../features/session/components/SessionOverviewPane/LinkedWorkChips';

const ROOT_PATH = '/mock/cascade/core-api';
const NOW = '2026-09-20T09:00:00.000Z' as IsoDateTime;

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

const LINEAR_ISSUE = {
  id: 'linear-uuid-41',
  identifier: 'HAR-41',
  title: 'Harborline invoices round the tax twice',
  description: 'The tax line is rounded before and after the discount.',
  url: 'https://linear.app/harborline/issue/HAR-41/invoices-round-twice',
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'HAR' },
  updatedAt: NOW,
};

const JIRA_ISSUE = {
  id: '10041',
  key: 'NW-41',
  summary: 'Northwind exports drop the currency column',
  description: 'The CSV export has no currency column since the last release.',
  status: 'To Do',
  statusCategory: 'new',
  issueType: 'Bug',
  priority: null,
  assignee: null,
  reporter: null,
  labels: [],
  created: NOW,
  updated: NOW,
  url: 'https://northwind.atlassian.net/browse/NW-41',
};

const GITLAB_ISSUE = {
  id: 9041,
  iid: 41,
  projectId: 7,
  title: 'ledger-core rejects rows with a trailing comma',
  description: 'Rows that end with a comma never reach the ledger.',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/ledger-core/-/issues/41',
  references: { full: 'acme/ledger-core#41' },
  updatedAt: NOW,
  milestone: null,
  labels: [],
};

const GITHUB_ISSUE = {
  number: 412,
  title: 'notify-relay retries forever on a 410',
  body: 'A gone endpoint keeps the retry loop alive.',
  url: 'https://github.com/acme/notify-relay/issues/412',
  state: 'OPEN',
  labels: [],
  updatedAt: NOW,
};

const SENTRY_ISSUE = {
  id: '4512001',
  shortId: 'CORE-API-2A',
  title: 'TypeError in the payments-api settlement job',
  culprit: 'settle_batch',
  level: 'error',
  status: 'unresolved',
  permalink: 'https://cascadia.sentry.io/issues/4512001/',
  count: '12',
  userCount: 3,
  firstSeen: NOW,
  lastSeen: NOW,
  metadata: null,
};

const LINKED_SENTRY_ISSUE = {
  ...SENTRY_ISSUE,
  id: '4512077',
  shortId: 'PAYMENTS-API-9',
  title: 'KeyError in the payments-api refund webhook',
  permalink: 'https://cascadia.sentry.io/issues/4512077/',
};

const BITBUCKET_REPO = {
  workspaceId: WORKSPACE_ID,
  workspaceSlug: 'cascadia',
  repoSlug: 'storefront-web',
  email: 'dev@cascadia.example',
};

const BITBUCKET_PR = {
  id: 41,
  title: 'storefront-web checkout keeps the old cart',
  description: '',
  state: 'OPEN',
  createdOn: NOW,
  updatedOn: NOW,
  sourceBranch: 'fix/cart',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: true,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
};

const base = {
  state: 'open',
  stateLabel: 'Open',
  updatedAt: NOW,
  context: 'Cascadia',
} as const;

type ProviderCase = {
  readonly provider: 'linear' | 'jira' | 'gitlab' | 'github' | 'sentry' | 'bitbucket';
  readonly label: string;
  readonly config: object;
  readonly record: InboxRecord;
  readonly identifier: string;
  readonly externalId: string;
  readonly routes: Record<string, (args: Record<string, unknown>) => unknown>;
  readonly pick: { readonly kind: 'option'; readonly name: RegExp } | { readonly kind: 'paste' };
};

const CASES: ReadonlyArray<ProviderCase> = [
  {
    provider: 'linear',
    label: 'Linear',
    config: { workspaceUrlKey: 'harborline', viewerUserId: 'u1', viewerName: 'Dev' },
    identifier: 'HAR-41',
    externalId: LINEAR_ISSUE.id,
    routes: { linear_fetch_assigned_issues: () => [LINEAR_ISSUE] },
    pick: { kind: 'option', name: /^Harborline invoices/ },
    record: {
      ...base,
      key: `linear:issue:${LINEAR_ISSUE.id}`,
      provider: 'linear',
      kind: 'issue',
      identifier: LINEAR_ISSUE.identifier,
      title: LINEAR_ISSUE.title,
      url: LINEAR_ISSUE.url,
      payload: { provider: 'linear', kind: 'issue', issue: LINEAR_ISSUE, sessionId: null },
    },
  },
  {
    provider: 'jira',
    label: 'Jira',
    config: { siteUrl: 'https://northwind.atlassian.net', email: 'dev@nw', projectKey: 'NW' },
    identifier: 'NW-41',
    externalId: JIRA_ISSUE.id,
    routes: { jira_list_issues: () => [JIRA_ISSUE] },
    pick: { kind: 'option', name: /^Northwind exports/ },
    record: {
      ...base,
      key: `jira:issue:${JIRA_ISSUE.id}`,
      provider: 'jira',
      kind: 'issue',
      identifier: JIRA_ISSUE.key,
      title: JIRA_ISSUE.summary,
      url: JIRA_ISSUE.url,
      payload: {
        provider: 'jira',
        kind: 'issue',
        issue: JIRA_ISSUE as unknown as Extract<
          InboxRecord['payload'],
          { provider: 'jira' }
        >['issue'],
        sessionId: null,
      },
    },
  },
  {
    provider: 'gitlab',
    label: 'GitLab',
    config: { userName: 'dev', userId: '1', host: 'gitlab.com' },
    identifier: 'acme/ledger-core#41',
    externalId: String(GITLAB_ISSUE.id),
    routes: { gitlab_fetch_assigned_issues: () => [GITLAB_ISSUE] },
    pick: { kind: 'option', name: /^ledger-core rejects/ },
    record: {
      ...base,
      key: `gitlab:issue:${GITLAB_ISSUE.id}`,
      provider: 'gitlab',
      kind: 'issue',
      identifier: GITLAB_ISSUE.references.full,
      title: GITLAB_ISSUE.title,
      url: GITLAB_ISSUE.webUrl,
      payload: { provider: 'gitlab', kind: 'issue', issue: GITLAB_ISSUE, sessionId: null },
    },
  },
  {
    provider: 'github',
    label: 'GitHub',
    config: {},
    identifier: '#412',
    externalId: '412',
    routes: {},
    pick: { kind: 'paste' },
    record: {
      ...base,
      key: `github:issue:${GITHUB_ISSUE.number}`,
      provider: 'github',
      kind: 'issue',
      identifier: '#412',
      title: GITHUB_ISSUE.title,
      url: GITHUB_ISSUE.url,
      payload: { provider: 'github', kind: 'issue', issue: GITHUB_ISSUE, sessionId: null },
    },
  },
  {
    provider: 'sentry',
    label: 'Sentry',
    config: { org: 'cascadia', project: 'core-api' },
    identifier: SENTRY_ISSUE.shortId,
    externalId: SENTRY_ISSUE.id,
    routes: {
      sentry_fetch_issues: (args) => ({
        issues: args.sentryProject === 'payments-api' ? [LINKED_SENTRY_ISSUE] : [SENTRY_ISSUE],
        next_cursor: null,
      }),
    },
    pick: { kind: 'option', name: /^TypeError in the payments-api/ },
    record: {
      ...base,
      state: 'alert',
      key: `sentry:error:${SENTRY_ISSUE.id}`,
      provider: 'sentry',
      kind: 'error',
      identifier: SENTRY_ISSUE.shortId,
      title: SENTRY_ISSUE.title,
      url: SENTRY_ISSUE.permalink,
      payload: { provider: 'sentry', kind: 'error', issue: SENTRY_ISSUE, sessionId: null },
    },
  },
  {
    provider: 'bitbucket',
    label: 'Bitbucket',
    config: { workspaceSlug: 'cascadia', email: 'dev@cascadia.example' },
    identifier: 'cascadia/storefront-web#41',
    externalId: 'cascadia/storefront-web#41',
    routes: {},
    pick: { kind: 'paste' },
    record: {
      ...base,
      key: `bitbucket:pr:${BITBUCKET_PR.id}`,
      provider: 'bitbucket',
      kind: 'pr',
      identifier: '#41',
      title: BITBUCKET_PR.title,
      url: 'https://bitbucket.org/cascadia/storefront-web/pull-requests/41',
      payload: {
        provider: 'bitbucket',
        kind: 'pr',
        pullRequest: BITBUCKET_PR as unknown as Extract<
          InboxRecord['payload'],
          { provider: 'bitbucket' }
        >['pullRequest'],
        repo: BITBUCKET_REPO,
      },
    },
  },
];

const SESSION_BUTTON_CASES = CASES.filter((entry) => entry.provider !== 'bitbucket');

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restoreActions: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  bridge.routes = {};
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restoreActions);
  restoreActions = {};
  vi.restoreAllMocks();
});

const stubActions = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  const originals = Object.fromEntries(
    Object.keys(actions).map((key) => [key, state[key as keyof StoreState]]),
  );
  restoreActions = { ...originals, ...restoreActions };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async (ui: ReactNode): Promise<void> => {
  render(<ToastProvider>{ui}</ToastProvider>);
  await settle();
};

const binding = (provider: IntegrationBinding['provider'], config: object): IntegrationBinding =>
  ({
    id: `binding-${provider}` as IntegrationBindingId,
    workspaceId: WORKSPACE_ID,
    projectId: null,
    credentialId: `credential-${provider}` as IntegrationCredentialId,
    provider,
    config,
    createdAt: NOW,
    updatedAt: NOW,
  }) as IntegrationBinding;

const seed = (entry: ProviderCase): Session => {
  seedBoardScene();
  useAppStore.setState({
    sessionExternalTasks: {},
    workspaceIntegrations: {
      [WORKSPACE_ID]: entry.provider === 'github' ? [] : [binding(entry.provider, entry.config)],
    },
  });
  bridge.routes = { ...entry.routes };
  const session = useAppStore.getState().sessions[0];
  if (session == null) {
    throw new Error('the board scene has no session');
  }
  return session;
};

type InboxItemProps = {
  readonly record: InboxRecord;
  readonly workspaceId: WorkspaceId;
};

const InboxItem = ({ record, workspaceId }: InboxItemProps) => {
  const linked = useInboxLinkedSessions({ workspaceId });
  return (
    <section aria-label="Inbox item">
      <InboxDetail
        record={attachLinkedSession({ record, linked })}
        workspaceId={workspaceId}
        rootPath={ROOT_PATH}
        errors={NO_ERRORS}
        onRefresh={() => undefined}
        onClose={() => undefined}
        onDeselect={() => undefined}
        launchFocusRequest={0}
      />
    </section>
  );
};

const surfaces = (session: Session, entry: ProviderCase, extra: ReactNode = null) => (
  <>
    <section aria-label="Session">
      {extra}
      <LinkedWorkChips sessionId={session.id} onSelectLens={() => undefined} />
    </section>
    <InboxItem record={entry.record} workspaceId={WORKSPACE_ID} />
  </>
);

const expectLinked = async (session: Session, entry: ProviderCase): Promise<void> => {
  await waitFor(() =>
    expect(useAppStore.getState().sessionExternalTasks[session.id]).toEqual([
      expect.objectContaining({
        provider: entry.provider,
        externalId: entry.externalId,
        identifier: entry.identifier,
      }),
    ]),
  );
  const sessionRegion = screen.getByRole('region', { name: 'Session' });
  expect(
    within(sessionRegion).getByRole('button', { name: `Open ${entry.identifier}` }),
  ).toBeDefined();
  const inboxRegion = screen.getByRole('region', { name: 'Inbox item' });
  expect(within(inboxRegion).getByRole('button', { name: /Open session/ })).toBeDefined();
  expect(within(inboxRegion).queryByRole('button', { name: /Launch session/ })).toBeNull();
};

describe('tasks and sessions on the real store', () => {
  it.each(CASES)('launches a session from a $label inbox item', async (entry) => {
    const session = seed(entry);
    const createSession = vi.fn(
      async (params: { readonly externalTasks?: ReadonlyArray<SessionExternalTask> }) => {
        useAppStore.setState((state) => ({
          sessionExternalTasks: {
            ...state.sessionExternalTasks,
            [session.id]: (params.externalTasks ?? []).map((task) => ({
              ...task,
              sessionId: session.id,
            })),
          },
        }));
        return { session };
      },
    );
    stubActions({
      createSession: createSession as unknown as StoreState['createSession'],
      requestIssueBrief: vi.fn(async () => undefined),
    });

    await mount(surfaces(session, entry));
    const inboxRegion = screen.getByRole('region', { name: 'Inbox item' });
    fireEvent.click(within(inboxRegion).getByRole('button', { name: /Launch session/ }));
    const panel = await screen.findByRole('region', { name: 'Launch session' });
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Session goal' }), {
      target: { value: 'Fix it' },
    });
    fireEvent.click(within(panel).getByRole('button', { name: /Launch session/ }));

    await waitFor(() => expect(createSession).toHaveBeenCalledOnce());
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        externalTasks: [
          expect.objectContaining({ provider: entry.provider, externalId: entry.externalId }),
        ],
      }),
    );
    await settle();
    await expectLinked(session, entry);
  });

  it('mounts the project linked to the sentry project when launching from its error', async () => {
    const entry = CASES.find((candidate) => candidate.provider === 'sentry');
    if (entry == null) {
      throw new Error('missing sentry case');
    }
    const session = seed(entry);
    const project = useAppStore.getState().projects.find((candidate) => candidate.kind === 'repo');
    if (project == null) {
      throw new Error('the board scene has no repo project');
    }
    useAppStore.setState({
      projectSentryLinks: {
        [WORKSPACE_ID]: [{ projectId: project.id, sentryProject: 'payments-api' }],
      },
    } as unknown as Partial<StoreState>);
    const createSession = vi.fn(async () => ({ session }));
    stubActions({
      createSession: createSession as unknown as StoreState['createSession'],
      requestIssueBrief: vi.fn(async () => undefined),
    });
    const record: InboxRecord = {
      ...entry.record,
      payload: {
        provider: 'sentry',
        kind: 'error',
        issue: { ...SENTRY_ISSUE, project: { slug: 'payments-api', name: 'payments-api' } },
        sessionId: null,
      } as InboxRecord['payload'],
    };

    await mount(<InboxItem record={record} workspaceId={WORKSPACE_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Launch session/ }));
    const panel = await screen.findByRole('region', { name: 'Launch session' });
    expect(
      within(panel).getByRole('combobox', { name: 'Project to work in' }).textContent,
    ).toContain(`Works in ${project.name}`);
    expect(within(panel).getByText('from Sentry project payments-api')).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: /Launch session/ }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: project.id,
          projectReason: 'from Sentry project payments-api',
        }),
      ),
    );
  });

  it.each(CASES)('links a $label inbox item to an existing session', async (entry) => {
    const session = seed(entry);

    await mount(surfaces(session, entry));
    const inboxRegion = screen.getByRole('region', { name: 'Inbox item' });
    fireEvent.click(within(inboxRegion).getByRole('combobox', { name: 'Link to a session' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Search sessions' }), {
      target: { value: session.goal },
    });
    fireEvent.click(
      await screen.findByRole('option', { name: (name) => name.includes(session.goal) }),
    );
    await settle();

    await expectLinked(session, entry);
  });

  it.each(SESSION_BUTTON_CASES)(
    'links a $label task from the session link button',
    async (entry) => {
      const session = seed(entry);
      if (entry.provider === 'github') {
        useAppStore.setState({
          githubWorkspaceStatus: {
            [WORKSPACE_ID]: { available: true, mode: 'pat', user: 'cascadia-bot', scopes: [] },
          },
        } as unknown as Partial<StoreState>);
      }

      await mount(surfaces(session, entry, <LinkIssueAction session={session} />));
      fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));
      const dialog = await screen.findByRole('dialog', { name: 'Link an issue' });
      const picker = within(dialog).getByRole('combobox');
      fireEvent.focus(picker);
      fireEvent.click(picker);
      if (entry.pick.kind === 'paste') {
        fireEvent.change(picker, { target: { value: entry.record.url } });
        fireEvent.click(await screen.findByRole('option', { name: `Link ${entry.identifier}` }));
      } else {
        fireEvent.click(await screen.findByRole('option', { name: entry.pick.name }));
      }
      await settle();

      await expectLinked(session, entry);
    },
  );

  it('finds a sentry issue of a linked sentry project from the session link button', async () => {
    const entry = CASES.find((candidate) => candidate.provider === 'sentry');
    if (entry == null) {
      throw new Error('missing sentry case');
    }
    const session = seed(entry);
    useAppStore.setState({
      projectSentryLinks: {
        [WORKSPACE_ID]: [
          {
            projectId: 'mock-board-project-payments-api' as ProjectId,
            sentryProject: 'payments-api',
          },
        ],
      },
    } as unknown as Partial<StoreState>);

    await mount(<LinkIssueAction session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link an issue' });
    const picker = within(dialog).getByRole('combobox');
    fireEvent.focus(picker);
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', { name: /^KeyError in the payments-api/ }));

    await waitFor(() =>
      expect(useAppStore.getState().sessionExternalTasks[session.id]).toEqual([
        expect.objectContaining({ provider: 'sentry', externalId: LINKED_SENTRY_ISSUE.id }),
      ]),
    );
  });

  it.each([
    { how: 'pasted link', value: 'https://cascadia.sentry.io/issues/4512099/' },
    { how: 'short code', value: 'core-api-3c' },
  ])(
    'links a sentry issue outside the list from its $how in the session link button',
    async ({ value }) => {
      const entry = CASES.find((candidate) => candidate.provider === 'sentry');
      if (entry == null) {
        throw new Error('missing sentry case');
      }
      const session = seed(entry);
      const resolved = {
        ...SENTRY_ISSUE,
        id: '4512099',
        shortId: 'CORE-API-3C',
        title: 'ValueError in the ledger-core nightly close',
        permalink: 'https://cascadia.sentry.io/issues/4512099/',
      };
      bridge.routes = {
        ...entry.routes,
        sentry_fetch_issue: () => resolved,
        sentry_resolve_short_id: () => resolved,
      };

      await mount(surfaces(session, entry, <LinkIssueAction session={session} />));
      fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));
      const dialog = await screen.findByRole('dialog', { name: 'Link an issue' });
      const picker = within(dialog).getByRole('combobox');
      fireEvent.focus(picker);
      fireEvent.change(picker, { target: { value } });
      fireEvent.click(
        await screen.findByRole('option', { name: 'Link CORE-API-3C' }, { timeout: 2000 }),
      );
      await settle();

      await waitFor(() =>
        expect(useAppStore.getState().sessionExternalTasks[session.id]).toEqual([
          expect.objectContaining({
            provider: 'sentry',
            externalId: '4512099',
            identifier: 'CORE-API-3C',
            title: resolved.title,
            url: resolved.permalink,
          }),
        ]),
      );
    },
  );

  it('shows a sentry issue linked from the session in the full inbox', async () => {
    const entry = CASES.find((candidate) => candidate.provider === 'sentry');
    if (entry == null) {
      throw new Error('missing sentry case');
    }
    const session = seed(entry);

    await mount(
      <>
        <LinkIssueAction session={session} />
        <InboxStudio
          workspaceId={WORKSPACE_ID}
          rootPath={ROOT_PATH}
          initialRecordKey={entry.record.key}
          onClose={() => undefined}
        />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link an issue' });
    const picker = within(dialog).getByRole('combobox');
    fireEvent.focus(picker);
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', { name: /^TypeError in the payments-api/ }));
    await settle();

    expect(await screen.findByRole('button', { name: /Open session/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Launch session/ })).toBeNull();
  });
});
