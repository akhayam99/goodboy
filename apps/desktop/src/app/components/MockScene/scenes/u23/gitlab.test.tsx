// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockWindows } from '@tauri-apps/api/mocks';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));
vi.mock('../../../../../shared/lib/editor', () => ({ openUrl }));

import { U23_GITLAB_SCENES } from './gitlab';
import { clearGitlabSceneWrites, gitlabSceneWrites } from './gitlabSeed';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearGitlabSceneWrites();
  mockWindows('main');
});

afterEach(() => {
  cleanup();
  openUrl.mockClear();
});

type SceneName = keyof typeof U23_GITLAB_SCENES;

const draw = ({ name }: { readonly name: SceneName }) => {
  const Scene = U23_GITLAB_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the gitlab page scenes', () => {
  it('registers the five scenes of the plan', () => {
    expect(Object.keys(U23_GITLAB_SCENES).sort()).toEqual([
      'branch-checks-gitlab-jobs',
      'branch-pr-gitlab',
      'branch-pr-gitlab-denied',
      'branch-pr-gitlab-merge',
      'branch-pr-gitlab-none',
    ]);
  });

  it('branch-pr-gitlab says merge request, MR and the number with the host nouns', async () => {
    draw({ name: 'branch-pr-gitlab' });

    expect(
      (await screen.findByRole('tab', { name: /^Merge request/ })).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop retried webhooks posting a second credit',
    );
    expect(screen.getByText('MR !42')).toBeDefined();
    expect(screen.queryByText(/pull request/i)).toBeNull();
  });

  it('branch-pr-gitlab reads reviewers, approvals, pipeline jobs and files from GitLab', async () => {
    draw({ name: 'branch-pr-gitlab' });
    const side = within(await screen.findByRole('complementary', { name: 'Properties' }));

    expect(await side.findByText('kenji-w')).toBeDefined();
    expect(side.getByText('Approved')).toBeDefined();
    expect(side.getByText('omar-t')).toBeDefined();
    expect(side.getByText('priya-n')).toBeDefined();
    expect(await side.findByText('5 files')).toBeDefined();
    expect(await side.findByText(/1 failing/)).toBeDefined();
  });

  it('branch-pr-gitlab keeps the description editable with Edit beside its heading', async () => {
    draw({ name: 'branch-pr-gitlab' });

    const description = await screen.findByRole('region', { name: 'Description' });
    expect(within(description).getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(within(description).getByText(/guard keyed on the delivery id/)).toBeDefined();
  });

  it('branch-pr-gitlab-merge asks for a method and shows what the project sets', async () => {
    draw({ name: 'branch-pr-gitlab-merge' });

    const group = await screen.findByRole(
      'group',
      { name: /Merge !42 into main/ },
      { timeout: 5_000 },
    );
    const methods = within(group).getByRole('tablist', { name: 'Merge method' });
    const squash = within(methods).getByRole('tab', { name: /Squash and merge/ });
    const rebase = within(methods).getByRole('tab', { name: /Rebase and merge/ });
    const merge = within(methods).getByRole('tab', { name: /Merge commit/ });
    expect((squash as HTMLButtonElement).disabled).toBe(true);
    expect((rebase as HTMLButtonElement).disabled).toBe(true);
    expect((merge as HTMLButtonElement).disabled).toBe(false);
    expect(merge.getAttribute('aria-selected')).toBe('true');
    expect(within(squash).getByText('Set by the project')).toBeDefined();
    expect(within(rebase).getByText('Set by the project')).toBeDefined();
  });

  it('branch-pr-gitlab-denied warns that the token lacks the scope and offers the settings', async () => {
    draw({ name: 'branch-pr-gitlab-denied' });

    expect(await screen.findByText("Goodboy can't read this merge request")).toBeDefined();
    expect(screen.getByText(/Give it the `api` scope/)).toBeDefined();
    const button = screen.getByRole('button', { name: 'Open GitLab settings' });
    const heard: Array<unknown> = [];
    window.addEventListener('goodboy:open-settings', (event) =>
      heard.push((event as CustomEvent).detail),
    );
    fireEvent.click(button);
    expect(heard).toEqual([{ scope: 'tools', tool: 'gitlab' }]);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('branch-checks-gitlab-jobs lists the jobs of the pipeline and never the old host notice', async () => {
    draw({ name: 'branch-checks-gitlab-jobs' });

    expect(await screen.findByText('lint')).toBeDefined();
    expect(screen.getByText('unit tests')).toBeDefined();
    expect(screen.getByText('integration tests')).toBeDefined();
    expect(screen.queryByText(/doesn't show GitLab pipelines/)).toBeNull();
  });

  it('branch-pr-gitlab-none offers the merge request create form', async () => {
    draw({ name: 'branch-pr-gitlab-none' });

    expect(await screen.findByRole('heading', { name: 'No merge request yet' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Merge request title' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Create MR/ })).toBeDefined();
  });

  it('branch-pr-gitlab edits the title and sends only the title', async () => {
    draw({ name: 'branch-pr-gitlab' });

    fireEvent.click(await screen.findByTitle(/^Edit title/));
    const input = await screen.findByRole('textbox', { name: 'Merge request title' });
    fireEvent.change(input, { target: { value: 'Stop a retried webhook posting twice' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(gitlabSceneWrites().filter((write) => write.command === 'gitlab_update_mr')).toEqual([
        {
          command: 'gitlab_update_mr',
          payload: expect.objectContaining({
            mrIid: 42,
            title: 'Stop a retried webhook posting twice',
          }),
        },
      ]),
    );
    const update = gitlabSceneWrites().find((write) => write.command === 'gitlab_update_mr');
    expect(update?.payload).not.toHaveProperty('description');
  });

  it('branch-pr-gitlab asks the project for reviewers and requests the one picked', async () => {
    draw({ name: 'branch-pr-gitlab' });

    fireEvent.click(await screen.findByRole('button', { name: 'Request review' }));
    fireEvent.click(await screen.findByRole('button', { name: /mara-q/ }));

    await waitFor(() =>
      expect(gitlabSceneWrites().filter((write) => write.command === 'gitlab_update_mr')).toEqual([
        {
          command: 'gitlab_update_mr',
          payload: expect.objectContaining({ mrIid: 42, reviewerIds: [4, 7, 8, 9] }),
        },
      ]),
    );
  });

  it('branch-pr-gitlab closes the merge request from the overflow after a confirm', async () => {
    draw({ name: 'branch-pr-gitlab' });

    fireEvent.click(await screen.findByRole('button', { name: 'Branch actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Close merge request/ }));
    const confirm = await screen.findByRole('group', { name: /Close !42 without merging/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Close merge request' }));

    await waitFor(() =>
      expect(
        gitlabSceneWrites().filter((write) => write.command === 'gitlab_update_mr_state'),
      ).toEqual([
        {
          command: 'gitlab_update_mr_state',
          payload: expect.objectContaining({ mrIid: 42, stateEvent: 'close' }),
        },
      ]),
    );
  });
});
