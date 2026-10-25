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
vi.mock('@goodboy/core', () => ({
  detectRepoSlug: h.detectRepoSlug,
  listMyReviewReplies: h.listMyReviewReplies,
  learnReplyStyle: h.learnReplyStyle,
}));

const WORKSPACE = 'workspace-1' as WorkspaceId;

const learn = () =>
  learnWorkspaceReplyStyle({
    workspaceId: WORKSPACE,
    projectRoots: ['/repos/ledger-core', '/repos/ledger-core-copy', '/notes'],
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

  it('says what is missing at each step', async () => {
    h.detectRepoSlug.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow('No folder in this workspace is a GitHub repository.');

    h.detectRepoSlug.mockResolvedValue('acme/ledger-core');
    h.listMyReviewReplies.mockResolvedValue([]);
    await expect(learn()).rejects.toThrow(
      "Couldn't find review replies you wrote in this workspace.",
    );

    h.listMyReviewReplies.mockResolvedValue([{ body: 'ok', createdAt: '' }]);
    h.learnReplyStyle.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow(
      "Couldn't write a style note from your replies. Try again.",
    );
  });
});
