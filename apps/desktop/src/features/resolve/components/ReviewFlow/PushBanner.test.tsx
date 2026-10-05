// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ResolvePublicationPreview } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { SESSION, seedResolveScene } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { PushBanner } from './PushBanner';
import type { ReviewPush } from './useReviewPush';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
});

afterEach(cleanup);

const commit = (sha: string, subject: string) => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  author: 'resolver',
  timestamp: 1,
  pushed: false,
  parentSha: null,
});

const PREVIEW: ResolvePublicationPreview = {
  publicationId: 'pub-318',
  repo: 'harborline/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [{ ...commit('a41c9e2aaaa', 'Redact the webhook payload'), threadIds: ['t-log'] }],
  unapproved: [],
  earlierCommits: [commit('9e4f1c2bbbb', 'Batch ledger lookups')],
  replies: [{ threadId: 't-log', body: 'Redacted.', revision: 1, closes: true }],
  notes: [],
  excluded: [{ threadId: 't-open', reason: 'needs_you' }],
  drift: [],
  blocker: null,
};

const push = (overrides: Partial<ReviewPush>): ReviewPush => ({
  phase: { kind: 'idle' },
  arm: vi.fn(async () => undefined),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
  askSync: vi.fn(),
  confirmSync: vi.fn(async () => undefined),
  dismiss: vi.fn(),
  recover: vi.fn(),
  ...overrides,
});

describe('PushBanner', () => {
  it('names the tip, the earlier commits that go along and what is left out', () => {
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({ phase: { kind: 'confirm', preview: PREVIEW } })}
      />,
    );

    const confirm = screen.getByRole('group', { name: 'Push 1 to hl/fix-duplicate-credit?' });
    within(confirm).getByText('Tip');
    within(confirm).getByText('Redact the webhook payload');
    within(confirm).getByText('This also pushes 1 earlier commit');
    within(confirm).getByText('Batch ledger lookups');
    within(confirm).getByText(/1 comment needs you first/);
  });

  it('offers Sync on a push that failed on a moved remote', () => {
    const askSync = vi.fn();
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({
          phase: {
            kind: 'result',
            result: { tone: 'failed', sentence: 'Nothing was pushed.', canSync: true },
          },
          askSync,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync and try again' }));
    expect(askSync).toHaveBeenCalledOnce();
  });
});
