import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import {
  NO_REVIEW_REPLIES,
  NO_STYLE_NOTE,
  NO_WORKSPACE_REPO,
  learnWorkspaceReplyStyle,
} from './learnWorkspaceReplyStyle';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  listMyReviewReplies: vi.fn(),
  learnReplyStyle: vi.fn(),
  resolveTaskModel: vi.fn(() => ({ providerId: 'anthropic', model: 'claude-haiku-4-5' })),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../github/github', () => ({ tauriGhRunner: { run: vi.fn() } }));
vi.mock('@goodboy/core', () => ({
  DEFAULT_SESSION_PROVIDER_PREFERENCE: { defaultProvider: 'anthropic' },
  detectRepoSlug: h.detectRepoSlug,
  listMyReviewReplies: h.listMyReviewReplies,
  learnReplyStyle: h.learnReplyStyle,
  resolveTaskModel: h.resolveTaskModel,
}));

const WORKSPACE = 'workspace-1' as WorkspaceId;

const learn = () =>
  learnWorkspaceReplyStyle({
    workspaceId: WORKSPACE,
    projectRoots: ['/repos/ledger-core', '/repos/ledger-core-copy', '/notes'],
    overrides: null,
    connectedProviders: ['anthropic'],
    limitContext: null,
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
    expect(h.resolveTaskModel).toHaveBeenCalledWith(
      expect.objectContaining({ task: 'prose_polish', connectedProviders: ['anthropic'] }),
    );
    expect(h.learnReplyStyle).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'anthropic', workingDir: '/repos/ledger-core' }),
      replies,
    );
  });

  it('says what is missing at each step', async () => {
    h.detectRepoSlug.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow(NO_WORKSPACE_REPO);

    h.detectRepoSlug.mockResolvedValue('acme/ledger-core');
    h.listMyReviewReplies.mockResolvedValue([]);
    await expect(learn()).rejects.toThrow(NO_REVIEW_REPLIES);

    h.listMyReviewReplies.mockResolvedValue([{ body: 'ok', createdAt: '' }]);
    h.learnReplyStyle.mockResolvedValue(null);
    await expect(learn()).rejects.toThrow(NO_STYLE_NOTE);
  });
});
