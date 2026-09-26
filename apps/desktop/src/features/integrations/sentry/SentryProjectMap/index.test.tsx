// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  IntegrationCredentialId,
  Project,
  ProjectId,
  ProjectSentryLink,
  WorkspaceId,
} from '@goodboy/types';
import { chooseListboxValue } from '../../../../__tests__/helpers/listbox';

const WORKSPACE = 'ws-northwind' as WorkspaceId;

const { state, client } = vi.hoisted(() => ({
  state: {
    projects: [] as ReadonlyArray<Project>,
    projectSentryLinks: {} as Record<string, ReadonlyArray<ProjectSentryLink>>,
    loadProjectSentryLinks: vi.fn(async (_params: unknown) => undefined),
    linkSentryProject: vi.fn(async (_params: unknown) => undefined),
    unlinkSentryProject: vi.fn(async (_params: unknown) => undefined),
  },
  client: {
    sentryListProjects: vi.fn(async (_params: unknown) => [
      { id: '4501', slug: 'payments-api', name: 'payments-api', platform: 'python' },
      { id: '4502', slug: 'payments-worker', name: 'payments-worker', platform: null },
      { id: '4503', slug: 'storefront-web', name: 'storefront-web', platform: 'javascript' },
    ]),
    sentryListCodeMappings: vi.fn(async (_params: unknown) => [
      {
        projectSlug: 'storefront-web',
        repoName: 'northwind/storefront-web',
        stackRoot: '',
        sourceRoot: '',
      },
    ]),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../client', () => client);

import { SentryProjectMap } from './index';

const project = (id: string, name: string): Project =>
  ({
    id: id as ProjectId,
    workspaceId: WORKSPACE,
    name,
    rootPath: `/code/${name}`,
    kind: 'repo',
  }) as Project;

const link = (projectId: string, sentryProject: string): ProjectSentryLink =>
  ({
    id: `${projectId}-${sentryProject}`,
    workspaceId: WORKSPACE,
    projectId: projectId as ProjectId,
    sentryOrg: 'northwind',
    sentryProject,
    sentryProjectName: sentryProject,
    source: 'manual',
  }) as ProjectSentryLink;

beforeEach(() => {
  state.projects = [project('ledger', 'ledger-core'), project('store', 'storefront-web')];
  state.projectSentryLinks = { [WORKSPACE]: [link('ledger', 'payments-api')] };
  state.linkSentryProject.mockClear();
  state.unlinkSentryProject.mockClear();
  state.loadProjectSentryLinks.mockClear();
});
afterEach(cleanup);

const renderMap = () =>
  render(
    <SentryProjectMap
      workspaceId={WORKSPACE}
      credentialId={'cred-1' as IntegrationCredentialId}
      org="northwind"
    />,
  );

describe('SentryProjectMap', () => {
  it('lists each project with the Sentry projects it reads', async () => {
    renderMap();

    const rows = within(
      screen.getByRole('list', { name: 'Projects and their Sentry projects' }),
    ).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('ledger-corepayments-api'),
      expect.stringContaining('storefront-webNo Sentry project'),
    ]);
    expect(state.loadProjectSentryLinks).toHaveBeenCalledWith({ workspaceId: WORKSPACE });
    await waitFor(() =>
      expect(client.sentryListProjects).toHaveBeenCalledWith({
        credentialId: 'cred-1',
        token: null,
        org: 'northwind',
      }),
    );
  });

  it('links a second Sentry project to the same project', async () => {
    renderMap();
    await waitFor(() =>
      expect(
        screen.getByLabelText('Sentry projects for ledger-core').hasAttribute('disabled'),
      ).toBe(false),
    );

    chooseListboxValue({
      trigger: screen.getByLabelText('Sentry projects for ledger-core'),
      value: 'payments-worker',
    });

    await waitFor(() =>
      expect(state.linkSentryProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        projectId: 'ledger',
        sentryOrg: 'northwind',
        sentryProject: 'payments-worker',
        sentryProjectName: 'payments-worker',
        source: 'manual',
      }),
    );
    expect(state.unlinkSentryProject).not.toHaveBeenCalled();
  });

  it('suggests a link from the code mappings and saves it when confirmed', async () => {
    renderMap();

    const suggestions = await screen.findByRole('region', {
      name: 'Suggested from Sentry code mappings',
    });
    fireEvent.click(within(suggestions).getByRole('button', { name: 'Link' }));

    await waitFor(() =>
      expect(state.linkSentryProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'store',
          sentryProject: 'storefront-web',
          source: 'code_mapping',
        }),
      ),
    );
  });
});
