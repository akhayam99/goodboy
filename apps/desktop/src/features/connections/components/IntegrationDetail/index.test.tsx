// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { IntegrationDetail } from './index';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'harborline' });
const CREDENTIAL_ID = brandId<IntegrationCredentialId>({ value: 'cred-gitlab' });
const CREATED_AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
const GITLAB: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-gitlab' }),
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: CREDENTIAL_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  provider: 'gitlab',
  config: { userName: 'Platform Lead', userId: '7', host: 'https://gitlab.northwind.dev' },
};
const GITLAB_USER = { id: 7, username: 'platform-lead', name: 'Platform Lead' };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaceIntegrations: { [WORKSPACE_ID]: [GITLAB] },
    toolUseCounts: { [WORKSPACE_ID]: { gitlab: { mergeRequests: 4, issues: 2 } } },
  });
});

afterEach(cleanup);

const renderGitlab = () =>
  render(
    <IntegrationDetail
      workspaceId={WORKSPACE_ID}
      workspaceName="Harborline"
      tool="gitlab"
      onUp={() => undefined}
    />,
  );

const typeKey = (value: string): void => {
  fireEvent.change(screen.getByLabelText('New personal access token'), {
    target: { value },
  });
};

describe('IntegrationDetail', () => {
  it('shows what the tool does in the workspace with the counts Tasks wrote', async () => {
    stubStoryInvoke({ integration_credential_has_secret: true });
    renderGitlab();

    const uses = await screen.findByRole('region', { name: 'In Harborline' });
    within(uses).getByRole('button', { name: 'Merge requests, 4' });
    within(uses).getByRole('button', { name: 'Issues in Tasks, 2' });
    await screen.findByText('Connected');
    const account = screen.getByRole('region', { name: 'Account' });
    within(account).getByText('Platform Lead');
    within(account).getByText('gitlab.northwind.dev');
  });

  it('pauses the uses and offers a new key in place when the key is missing', async () => {
    stubStoryInvoke({ integration_credential_has_secret: false });
    renderGitlab();

    const alert = await screen.findByRole('alert');
    within(alert).getByText('The GitLab key is missing from this Mac.');
    const uses = screen.getByRole('region', { name: 'In Harborline' });
    within(uses).getByRole('button', { name: 'Merge requests, Paused' });
    expect(screen.queryByRole('button', { name: /Disconnect/ })).toBeNull();
  });

  it('keeps the old state and the typed key when the host refuses, then saves on retry', async () => {
    let isRefused = true;
    stubStoryInvoke({
      integration_credential_has_secret: false,
      gitlab_validate_connection: () => {
        if (isRefused) {
          throw new Error('401 Unauthorized');
        }
        return GITLAB_USER;
      },
      integration_binding_replace_secret: null,
    });
    renderGitlab();

    fireEvent.click(await screen.findByRole('button', { name: 'Paste a new key' }));
    typeKey('glpat-new');
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await screen.findByText("GitLab didn't accept this key. Check it and try again.");
    expect(screen.getByLabelText('New personal access token')).toHaveProperty('value', 'glpat-new');
    screen.getByText('Key missing');
    expect(useAppStore.getState().workspaceIntegrations[WORKSPACE_ID]).toEqual([GITLAB]);

    isRefused = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText('Key missing')).toBeNull());
    screen.getByText('Connected');
    expect(screen.queryByLabelText('New personal access token')).toBeNull();
    expect(useAppStore.getState().workspaceIntegrations[WORKSPACE_ID]).toEqual([GITLAB]);
  });

  it('shows the setup path of a tool that is not connected', async () => {
    stubStoryInvoke({});
    render(
      <IntegrationDetail
        workspaceId={WORKSPACE_ID}
        workspaceName="Harborline"
        tool="jira"
        onUp={() => undefined}
      />,
    );

    await screen.findByRole('region', { name: 'Connect Jira' });
    screen.getByText('Not set up');
    expect(screen.queryByRole('region', { name: 'In Harborline' })).toBeNull();
  });
});
