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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  brandId,
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
import { FirstSessionStep } from './FirstSessionStep';

let useAppStore: StoryStore;

const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });

const ACME_WEB: Project = buildStoryProject({
  workspaceId: ACME,
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  name: 'acme-web',
  rootPath: '/mock/Code/acme-web',
  kind: 'repo',
  baseBranch: 'main',
});

const LINEAR_ISSUES = [
  {
    id: 'mock-linear-acm-112',
    identifier: 'ACM-112',
    title: 'Checkout submits twice on a slow network',
    description: null,
    url: 'https://example.invalid/linear/ACM-112',
    state: { name: 'Todo', type: 'unstarted' },
    team: { key: 'ACM' },
    updatedAt: STORY_NOW,
  },
];

type RenderParams = {
  readonly onStart?: () => Promise<void>;
};

const renderStep = ({ onStart = async () => undefined }: RenderParams = {}) => {
  const handlers = {
    onStart: vi.fn(onStart),
    onDraft: vi.fn(),
    onSkip: vi.fn(),
    onOpenTools: vi.fn(),
  };
  render(
    <FirstSessionStep
      workspaceId={ACME}
      folder={ACME_WEB}
      agent="anthropic"
      mode="full"
      isLocked={false}
      onBack={() => undefined}
      {...handlers}
    />,
  );
  return handlers;
};

const prompt = () => {
  const field = screen.getByRole('textbox', { name: 'What Scout should do' });
  if (!(field instanceof HTMLTextAreaElement)) {
    throw new Error('the prompt is not a text area');
  }
  return field;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ linear_fetch_assigned_issues: LINEAR_ISSUES });
});

afterEach(cleanup);

describe('FirstSessionStep', () => {
  it('opens on one input card that names the folder, the agent and the branch', () => {
    renderStep();

    expect(prompt().value).toContain('Explain how acme-web is organized');
    expect(screen.getByRole('button', { name: 'Explain how acme-web is organized' })).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();
    expect(screen.getByText('reads only')).toBeDefined();
    expect(screen.getByText('acme-web · main')).toBeDefined();
  });

  it('fills the input card from a starter chip', () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Find one small bug' }));

    expect(prompt().value).toContain('Find one small, real bug in acme-web');
  });

  it('starts with the prompt, and on failure keeps it and reads Retry', async () => {
    const handlers = renderStep({
      onStart: async () => {
        throw new Error('the worktree could not be created');
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /^start/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('the worktree could not be created'),
    );
    expect(handlers.onStart).toHaveBeenCalledWith({
      prompt: expect.stringContaining('Explain how acme-web is organized'),
    });
    expect(screen.getByRole('button', { name: /^retry/i })).toBeDefined();
    expect(prompt().value).toContain('Explain how acme-web is organized');
  });

  it('skips with the one skip word in setup', () => {
    const handlers = renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(handlers.onSkip).toHaveBeenCalledOnce();
  });

  it('hides the issue tab until a task source is connected and points at Tools', () => {
    const handlers = renderStep();

    expect(screen.queryByRole('tab', { name: 'Pick up an issue' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Tools' }));

    expect(handlers.onOpenTools).toHaveBeenCalledOnce();
  });

  it('drafts a brief from the picked issue once Linear is connected', async () => {
    useAppStore.setState({
      workspaceIntegrations: {
        [ACME]: [
          {
            id: brandId<IntegrationBindingId>({ value: 'binding-linear' }),
            workspaceId: ACME,
            projectId: null,
            credentialId: brandId<IntegrationCredentialId>({ value: 'credential-linear' }),
            provider: 'linear',
            config: { workspaceUrlKey: 'acme', viewerUserId: 'viewer-dana', viewerName: 'Dana K.' },
            createdAt: STORY_NOW,
            updatedAt: STORY_NOW,
          },
        ],
      },
    });
    const handlers = renderStep();

    fireEvent.click(screen.getByRole('tab', { name: 'Pick up an issue' }));
    fireEvent.click(await screen.findByRole('button', { name: /ACM-112/ }));
    fireEvent.click(screen.getByRole('button', { name: /draft the brief/i }));

    expect(handlers.onDraft).toHaveBeenCalledWith({
      issue: expect.objectContaining({ identifier: 'ACM-112' }),
    });
  });
});
