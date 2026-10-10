// @vitest-environment happy-dom

import { useInheritedPaneActions } from '@goodboy/ui';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  IsoDateTime,
  PullRequestState,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

type Props = {
  readonly title: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
};

type TaskDetailProps = {
  readonly task: SessionExternalTask;
};

const h = vi.hoisted(() => ({
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../integrations/linear/client', async () =>
  (await import('../../../../../../store/storyHarness')).linearClientModuleMock(),
);

vi.mock('../../../../../integrations/hooks/useWorkspaceIssueLookup', () => ({
  useWorkspaceIssueLookup: () => ({ code: null, settled: null, loadingProviders: [] }),
}));

vi.mock('../../../../../../shared/lib/editor', () => ({
  openUrl: h.openUrl,
}));

vi.mock('./LinearTaskDetail', () => ({
  LinearTaskDetail: ({ task }: TaskDetailProps) => (
    <div data-testid="task-detail">
      <a href="https://linear.app/GB-42" aria-label="Open in Linear">
        Linear detail {task.externalId}
      </a>
      <button type="button" aria-label="Copy issue link" />
      <div data-testid="task-detail-actions">{useInheritedPaneActions()}</div>
    </div>
  ),
}));

vi.mock('./GitlabTaskDetail', () => ({
  GitlabTaskDetail: ({ task }: TaskDetailProps) => (
    <div data-testid="task-detail">
      <a href="https://gitlab.com/acme/web/-/issues/3" aria-label="Open in GitLab">
        GitLab detail {task.externalId}
      </a>
      <button type="button" aria-label="Copy issue link" />
      <div data-testid="task-detail-actions">{useInheritedPaneActions()}</div>
    </div>
  ),
}));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  PaneShell: ({ title, children, actions }: Props) => (
    <div>
      <h1>{title}</h1>
      {actions}
      {children}
    </div>
  ),
}));

import { IntegrationPane } from './index';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { UndoToastBridge } from '../../../../../../app/components/UndoToastBridge';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  ProjectId,
  MountId,
} from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../../store/storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const CREATED_AT = '2026-07-22T12:00:00.000Z' as IsoDateTime;
const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-42',
  identifier: 'GB-42',
  title: 'Refactor integration storage',
  url: 'https://linear.app/goodboy/issue/GB-42/refactor-integration-storage',
  createdAt: CREATED_AT,
};
const SECOND_TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-43',
  identifier: 'GB-43',
  title: 'Trim the integration pane',
  url: 'https://linear.app/goodboy/issue/GB-43/trim-the-integration-pane',
  createdAt: CREATED_AT,
};
const MERGED_PR: PullRequestState = {
  number: 42,
  title: 'Refactor integration storage',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'merged',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/current',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: CREATED_AT,
};
const GITLAB_TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'gitlab',
  externalId: 'acme/web#3',
  identifier: 'acme/web#3',
  title: 'Restore the pipeline',
  url: 'https://gitlab.com/acme/web/-/issues/3',
  createdAt: CREATED_AT,
};
const PROJECT_ID = 'project-ledger-core' as ProjectId;

beforeEach(async () => {
  await resetStoryStore();
  storySpies.linearValidateConnection.mockResolvedValue({
    id: 'viewer-northwind',
    name: 'Northwind',
    organization: { id: 'org-northwind', name: 'Northwind', urlKey: 'northwind' },
  });
  storySpies.linearConnect.mockResolvedValue(undefined);
  useAppStore.setState({
    sessionExternalTasks: { [SESSION_ID]: [TASK] },
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    workspaces: [aWorkspace({ id: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, kind: 'repo' })],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: 'mount-ledger-core' as MountId,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: '/tmp/ledger-core/current',
          lastWorktreePath: null,
          repoRoot: '/tmp/ledger-core',
          branch: 'ak/current',
          baseBranch: 'main',
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    githubWorkspaceStatus: { [WORKSPACE_ID]: null },
    workspaceIntegrations: {
      [WORKSPACE_ID]: [
        {
          id: 'binding-linear' as IntegrationBindingId,
          workspaceId: WORKSPACE_ID,
          projectId: null,
          credentialId: 'credential-linear' as IntegrationCredentialId,
          provider: 'linear',
          config: {
            workspaceUrlKey: 'northwind',
            viewerUserId: 'viewer-northwind',
            viewerName: 'Northwind',
          },
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
        {
          id: 'binding-gitlab' as IntegrationBindingId,
          workspaceId: WORKSPACE_ID,
          projectId: null,
          credentialId: 'credential-gitlab' as IntegrationCredentialId,
          provider: 'gitlab',
          config: { userName: 'Northwind', userId: 'viewer-northwind', host: 'gitlab.com' },
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
      ],
    },
  });
  stubStoryInvoke({
    gh_run: '',
    gitlab_fetch_assigned_issues: [],
    gitlab_fetch_assigned_mrs: [],
  });
  h.openUrl.mockClear();
});

afterEach(cleanup);

describe('parseIntegrationTaskUrl', () => {
  it('parses provider URLs and falls back to their trailing segment', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'linear',
        rawUrl: 'linear.app/goodboy/issue/GB-42/refactor-integration-storage',
      }),
    ).toMatchObject({ externalId: 'GB-42', identifier: 'GB-42', title: 'GB-42' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'sentry',
        rawUrl: 'https://sentry.io/organizations/goodboy/issues/12345/events/latest/',
      }),
    ).toMatchObject({ externalId: '12345', identifier: '12345' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'gitlab',
        rawUrl: 'https://gitlab.com/acme/web/-/issues/7',
      }),
    ).toMatchObject({ externalId: 'acme/web#7', identifier: 'acme/web#7' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'jira',
        rawUrl: 'https://acme.atlassian.net/browse/ENG-142',
      }),
    ).toMatchObject({ externalId: 'ENG-142', identifier: 'ENG-142', title: 'ENG-142' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'linear',
        rawUrl: 'not a valid URL/item-9',
      }),
    ).toMatchObject({
      externalId: 'not a valid URL/item-9',
      identifier: 'item-9',
      url: 'not a valid URL/item-9',
    });
  });
});

describe('IntegrationPane', () => {
  it.each([['linear', TASK, 'Linear']] as const)(
    'shows one open and copy affordance for a linked %s task with detail',
    (provider, task, host) => {
      useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [task] } });

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );
      fireEvent.click(screen.getByRole('button', { name: `View ${task.identifier}` }));

      expect(screen.getAllByRole('link', { name: `Open in ${host}` })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Copy issue link' })).toHaveLength(1);
    },
  );

  it.each([
    ['linear', TASK, 'Linear detail GB-42'],
    ['gitlab', GITLAB_TASK, 'GitLab detail acme/web#3'],
  ] as const)(
    'opens the %s issue the session focused from another surface',
    (provider, task, detailText) => {
      useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [task] } });
      useAppStore.setState({
        focusedExternalTask: {
          [SESSION_ID]: { provider, externalId: task.externalId, projectId: null },
        },
      });

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );

      expect(screen.getByText(detailText)).toBeDefined();
      expect(screen.getByRole('button', { name: 'All issues' })).toBeDefined();
    },
  );

  it.each([
    ['linear', TASK, 'Linear detail GB-42'],
    ['gitlab', GITLAB_TASK, 'GitLab detail acme/web#3'],
  ] as const)(
    'lists the %s issues when the lens opens with nothing focused',
    (provider, task, detailText) => {
      useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [task] } });

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );

      expect(screen.getByRole('button', { name: `View ${task.identifier}` })).toBeDefined();
      expect(screen.queryByText(detailText)).toBeNull();
    },
  );

  it.each([0, 1, 2] as const)('states its section title with %i linked records', (count) => {
    useAppStore.setState({
      sessionExternalTasks: { [SESSION_ID]: [TASK, SECOND_TASK].slice(0, count) },
    });

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByRole('heading', { name: 'Linear' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^View GB-/ })).toHaveLength(count);
    expect(screen.queryByTestId('task-detail')).toBeNull();
  });

  it('hands its actions to the focused record header, with no eyebrow row above it', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);
    fireEvent.click(screen.getByRole('button', { name: 'View GB-42' }));

    const actions = screen.getByTestId('task-detail-actions');

    expect(screen.queryByText('Linear')).toBeNull();
    expect(within(actions).getByRole('button', { name: 'Unlink GB-42' })).toBeDefined();
    expect(within(actions).getByRole('button', { name: 'All issues' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Link/ })).toBeNull();
  });

  it('puts Link work in the tracker list header and leaves it out of a focused issue', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByRole('button', { name: 'Link work' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'View GB-42' }));

    expect(screen.queryByRole('button', { name: 'Link work' })).toBeNull();
  });

  it('lists every linked task as a card and focuses the clicked one', () => {
    useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [TASK, SECOND_TASK] } });

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getAllByRole('button', { name: /^View GB-/ })).toHaveLength(2);
    expect(screen.getByText('Trim the integration pane')).toBeDefined();
    expect(screen.queryByText('Linear detail GB-42')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View GB-43' }));

    expect(screen.getByText('Linear detail GB-43')).toBeDefined();
    expect(screen.getByRole('button', { name: 'All issues' })).toBeDefined();
  });

  it('folds a merged work item behind a completed count until expanded', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          { ...TASK, branch: 'ak/current' },
          { ...SECOND_TASK, branch: 'ak/shipped' },
        ],
      },
    });
    useAppStore.setState({ sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: [MERGED_PR] } } });

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    const toggle = screen.getByRole('button', { name: 'Show completed (2)' });
    expect(screen.queryByText('ak/shipped')).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByText('ak/shipped')).toBeDefined();
  });

  it('renders no completed toggle when nothing is completed', () => {
    useAppStore.setState({
      sessionExternalTasks: { [SESSION_ID]: [{ ...TASK, branch: 'ak/current' }] },
    });

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.queryByRole('button', { name: /^Completed/ })).toBeNull();
  });

  it('unlinks the focused task immediately and restores it through app Undo', async () => {
    render(
      <ToastProvider>
        <UndoToastBridge />
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View GB-42' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink GB-42' }));
    });
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toEqual([]);
    expect(screen.queryByRole('group', { name: /Unlink/ })).toBeNull();
    expect(screen.getByText('Unlinked GB-42')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toEqual([TASK]);
  });

  const pasteLinearLink = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Link work' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search work to link' }), {
      target: { value: 'https://linear.app/goodboy/issue/GB-99/new-link' },
    });
  };

  it('links a pasted provider URL from Link work with the closing line kept', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    pasteLinearLink();
    expect(screen.getByText('Will close GB-99 when merged ·')).toBeDefined();
    fireEvent.click(screen.getByRole('option', { name: 'Link GB-99' }));

    await waitFor(() =>
      expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toHaveLength(2),
    );
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toContainEqual(
      expect.objectContaining({
        provider: 'linear',
        externalId: 'GB-99',
        identifier: 'GB-99',
        relation: 'closes',
        url: 'https://linear.app/goodboy/issue/GB-99/new-link',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Link work' })).toBeNull());
  });

  it('writes part-of when the closing line is switched off', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    pasteLinearLink();
    fireEvent.click(screen.getByRole('button', { name: 'Don’t close' }));
    fireEvent.click(screen.getByRole('option', { name: 'Link GB-99' }));

    await waitFor(() =>
      expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toHaveLength(2),
    );
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toContainEqual(
      expect.objectContaining({ externalId: 'GB-99', relation: 'part-of' }),
    );
  });

  it('opens the empty state link picker filtered to the tracker', async () => {
    useAppStore.setState({ sessionExternalTasks: {} });
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="gitlab" />);

    expect(screen.getByText('No GitLab issues linked')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Link work' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Open GitLab studio' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Link work' }));

    expect(screen.getByRole('dialog', { name: 'Link work' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Search work to link' })).toBeDefined();
    const filter = await screen.findByRole('tablist', { name: 'Filter by source' });
    expect(
      within(filter)
        .getByRole('tab', { name: /GitLab/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('shows the provider connection form inline when disconnected', async () => {
    useAppStore.setState({ sessionExternalTasks: {} });
    useAppStore.setState({ workspaceIntegrations: {} });
    const listener = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', listener);

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByRole('heading', { name: 'Linear' })).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Search work to link' })).toBeNull();
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'lin_api_test' },
    });
    await waitFor(
      () =>
        expect(useAppStore.getState().workspaceIntegrations[WORKSPACE_ID]).toContainEqual(
          expect.objectContaining({
            provider: 'linear',
            config: expect.objectContaining({ viewerUserId: 'viewer-northwind' }),
          }),
        ),
      { timeout: 2000 },
    );
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-linear-studio', listener);
  });

  it.each([['linear', TASK, 'Linear detail GB-42']] as const)(
    'keeps linked %s rows without rendering live detail while disconnected',
    (provider, task, detailText) => {
      useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [task] } });
      useAppStore.setState({ workspaceIntegrations: {} });

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );

      expect(screen.getByText(task.title)).toBeDefined();
      expect(screen.queryByText(detailText)).toBeNull();
    },
  );
});
