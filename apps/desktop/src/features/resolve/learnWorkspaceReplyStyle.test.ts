// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { learnWorkspaceReplyStyle } from './learnWorkspaceReplyStyle';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  listMyReviewReplies: vi.fn(),
  learnReplyStyle: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../integrations/github/github', () => ({ tauriGhRunner: { run: vi.fn() } }));
vi.mock('@goodboy/core/github', () => ({
  detectRepoSlug: h.detectRepoSlug,
  listMyReviewReplies: h.listMyReviewReplies,
  learnReplyStyle: h.learnReplyStyle,
}));

const WORKSPACE = 'workspace-1' as WorkspaceId;

const ROOTS = ['/repos/ledger-core', '/repos/ledger-core-copy', '/notes'];

const learn = (githubRoots: ReadonlyArray<string> = ROOTS) =>
  learnWorkspaceReplyStyle({
    workspaceId: WORKSPACE,
    githubRoots,
    taskModel: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
  });

beforeEach(() => {
  h.detectRepoSlug.mockReset();
  h.listMyReviewReplies.mockReset();
  h.learnReplyStyle.mockReset();
  h.detectRepoSlug.mockImplementation(async (_runner: unknown, root: string) =>
    root === '/notes' ? null : 'acme/ledger-core',
  );
});

describe('learnWorkspaceReplyStyle', () => {
  it('reads my replies once per repository and turns them into a style note', async () => {
    const replies = [{ body: 'done in 4f21c8b', createdAt: '2026-09-01T10:00:00Z' }];
    h.listMyReviewReplies.mockResolvedValue(replies);
    h.learnReplyStyle.mockResolvedValue('Short.');

    expect(await learn()).toBe('Short.');
    expect(h.listMyReviewReplies).toHaveBeenCalledWith(
      expect.objectContaining({ repoSlugs: ['acme/ledger-core'] }),
    );
    expect(h.learnReplyStyle).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'anthropic', workingDir: '/repos/ledger-core' }),
      replies,
    );
  });

  it('says what is missing at each step and that the note is unchanged', async () => {
    await expect(learn([])).rejects.toThrow(
      'No project in this workspace is on GitHub. Your note is unchanged.',
    );

    h.detectRepoSlug.mockResolvedValue('acme/ledger-core');
    h.listMyReviewReplies.mockResolvedValue([]);
    await expect(learn()).rejects.toThrow(
      "Couldn't find review replies you wrote on GitHub. Your note is unchanged.",
    );

    h.listMyReviewReplies.mockResolvedValue([{ body: 'ok', createdAt: '' }]);
    h.learnReplyStyle.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow(
      "Couldn't write a style note from your replies. Your note is unchanged.",
    );
  });

  it('names Connect GitHub instead of the raw gh message when gh is signed out', async () => {
    h.detectRepoSlug.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow(
      'Connect GitHub to read your replies. Your note is unchanged.',
    );

    h.detectRepoSlug.mockResolvedValue('acme/ledger-core');
    h.listMyReviewReplies.mockRejectedValue(
      new Error('To get started with GitHub CLI, please run:  gh auth login'),
    );
    await expect(learn()).rejects.toThrow(
      'Connect GitHub to read your replies. Your note is unchanged.',
    );
  });
});
