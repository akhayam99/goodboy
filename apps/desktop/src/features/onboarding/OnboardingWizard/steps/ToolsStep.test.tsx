// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type Project,
  type ProjectId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryProject,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToolsStep } from './ToolsStep';

let useAppStore: StoryStore;

const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });

const ACME_WEB: Project = buildStoryProject({
  workspaceId: ACME,
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  name: 'acme-web',
  rootPath: '/mock/Code/acme-web',
  kind: 'repo',
});

const ACME_DOCS: Project = buildStoryProject({
  workspaceId: ACME,
  id: brandId<ProjectId>({ value: 'project-acme-docs' }),
  name: 'acme-docs',
  rootPath: '/mock/Code/acme-docs',
  kind: 'folder',
});

type BindingParams = {
  readonly workspaceId: WorkspaceId;
};

const linearOf = ({ workspaceId }: BindingParams): IntegrationBinding => ({
  id: brandId<IntegrationBindingId>({ value: `binding-${workspaceId}` }),
  workspaceId,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-linear' }),
  provider: 'linear',
  config: { workspaceUrlKey: 'acme', viewerUserId: 'viewer-dana', viewerName: 'Dana K.' },
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
});

type RenderParams = {
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<Project>;
  readonly onContinue?: () => void;
};

const step = ({ workspaceId, projects, onContinue = () => undefined }: RenderParams) => (
  <ToolsStep
    workspaceId={workspaceId}
    workspaceName="Acme web"
    projects={projects}
    mode="full"
    isLocked={false}
    onBack={() => undefined}
    onContinue={onContinue}
    onOpenSettings={() => undefined}
  />
);

const tasks = () => within(screen.getByRole('region', { name: 'Tasks' }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_remote_url: 'git@github.com:acme/acme-web.git' });
});

afterEach(cleanup);

describe('ToolsStep', () => {
  it('binds to the created workspace after a switch', () => {
    useAppStore.setState({
      workspaceIntegrations: { [ACME]: [linearOf({ workspaceId: ACME })], [NORTHWIND]: [] },
    });
    const { rerender } = render(step({ workspaceId: ACME, projects: [ACME_WEB] }));
    expect(tasks().getByText('Ready')).toBeDefined();

    rerender(step({ workspaceId: NORTHWIND, projects: [ACME_WEB] }));

    expect(tasks().getByText('Ready')).toBeDefined();
    expect(tasks().queryByRole('button', { name: 'Connect Linear' })).toBeNull();
  });

  it('puts the detected host first and folds the others away', async () => {
    useAppStore.setState({
      githubStatus: { mode: 'gh-cli', available: true, user: 'acme-bot', scopes: ['repo'] },
    });
    render(step({ workspaceId: ACME, projects: [ACME_WEB] }));
    const code = within(screen.getByRole('region', { name: 'Code' }));

    await waitFor(() =>
      expect(code.getByText('Signed in as acme-bot. acme-web pushes here')).toBeDefined(),
    );
    expect(code.queryByText('GitLab')).toBeNull();
    fireEvent.click(code.getByRole('button', { name: /other code hosts/i }));
    expect(code.getByText('GitLab')).toBeDefined();
    expect(tasks().getByText('GitHub Issues')).toBeDefined();
  });

  it('keeps Tools for a plain folder and says why there is no code host', () => {
    render(step({ workspaceId: ACME, projects: [ACME_DOCS] }));

    expect(screen.getByText('Acme web has no git folders')).toBeDefined();
    expect(tasks().getByRole('button', { name: 'Connect Linear' })).toBeDefined();
  });

  it('continues with nothing connected, which is the skip', () => {
    const onContinue = vi.fn();
    render(step({ workspaceId: ACME, projects: [ACME_WEB], onContinue }));

    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^continue/i }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
