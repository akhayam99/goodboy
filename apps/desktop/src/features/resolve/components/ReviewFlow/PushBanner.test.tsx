// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type ProjectId,
  type ResolvePublicationPreview,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { PushBanner } from './PushBanner';
import type { ReviewPush } from './useReviewPush';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
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
  fixTarget: null,
  retryAfterFix: vi.fn(),
  arm: vi.fn(async () => undefined),
  press: vi.fn(async () => undefined),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
  askSync: vi.fn(),
  confirmSync: vi.fn(async () => undefined),
  dismiss: vi.fn(),
  recover: vi.fn(),
  ...overrides,
});

describe('PushBanner', () => {
  it('lists every commit that goes out, marks the ones that are not fixes and says what is left out', () => {
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({ phase: { kind: 'confirm', preview: PREVIEW } })}
      />,
    );

    const confirm = screen.getByRole('group', {
      name: 'Push 2 commits to hl/fix-duplicate-credit?',
    });
    const rows = within(confirm).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const [firstRow, secondRow] = rows;
    if (firstRow === undefined || secondRow === undefined) {
      throw new Error('the confirm lists two commits');
    }
    expect(firstRow.textContent).toContain('Batch ledger lookups');
    expect(within(firstRow).getByText('Not a fix')).toBeDefined();
    expect(secondRow.textContent).toContain('Redact the webhook payload');
    expect(within(secondRow).queryByText('Not a fix')).toBeNull();
    expect(within(confirm).queryByText('Tip')).toBeNull();
    within(confirm).getByText(/1 comment needs you first/);
  });

  it('names the commit style setting as a link that opens Replies and commits', () => {
    const details: Array<unknown> = [];
    const onOpenSettings = (event: Event) => {
      if (event instanceof CustomEvent) {
        details.push(event.detail);
      }
    };
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({ phase: { kind: 'confirm', preview: PREVIEW } })}
      />,
    );

    const confirm = screen.getByRole('group', {
      name: 'Push 2 commits to hl/fix-duplicate-credit?',
    });
    within(confirm).getByText(/set in/);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Replies and commits' }));
    window.removeEventListener('goodboy:open-settings', onOpenSettings);

    expect(details).toEqual([{ scope: 'workspace', section: 'review-replies' }]);
  });

  it('says what changed above the refreshed confirm', () => {
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({
          phase: {
            kind: 'confirm',
            preview: PREVIEW,
            changed: 'The remote moved from 7d02b11 to c5d9e08',
          },
        })}
      />,
    );

    const line = screen.getByText('The remote moved from 7d02b11 to c5d9e08.');
    const confirm = screen.getByRole('group', { name: /^Push 2 commits to/ });
    expect(line.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(confirm).queryByText(/The remote moved/)).toBeNull();
  });

  it('shows nothing while a push without a panel runs', () => {
    const { container } = render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({ phase: { kind: 'pushing', preview: PREVIEW, hasPanel: false } })}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('keeps the panel up, busy, while a push from the panel runs', () => {
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({ phase: { kind: 'pushing', preview: PREVIEW, hasPanel: true } })}
      />,
    );

    expect(screen.getByRole('group', { name: /^Push 2 commits to/ })).toBeDefined();
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

  it('shows the failing check and its first findings, and starts an agent that carries the pending replies', () => {
    const fixBranchPushWithAgent = vi.fn(async () => undefined);
    store.setState({ fixBranchPushWithAgent });
    const output = [
      '$ yarn knip --cache',
      'Unused files (15)',
      'src/legacy/ledgerExport.ts',
      'husky - pre-push script failed (code 1)',
      'error: failed to push some refs',
    ].join('\n');
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({
          phase: {
            kind: 'result',
            result: { tone: 'failed', sentence: 'Nothing was pushed.', failure: { output } },
          },
          fixTarget: { mountId: MOUNT_TARGET.mountId, pending: 'Replies for #318 wait.' },
        })}
      />,
    );

    screen.getByText('pre-push: yarn knip --cache failed');
    expect(screen.getByText(/Unused files \(15\)/).textContent).toContain('ledgerExport.ts');
    fireEvent.click(screen.getByRole('button', { name: 'Let an agent fix the push' }));

    expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION.id,
        mountId: MOUNT_TARGET.mountId,
        isForce: false,
        message: output,
        pending: 'Replies for #318 wait.',
      }),
    );
  });

  it('tracks the running agent instead of offering a second one, and retries once the fix is pushed', () => {
    const retryAfterFix = vi.fn();
    const agentId = brandId<AgentId>({ value: 'agent-push-fix' });
    store.setState({
      branchPushFixes: {
        [agentId]: {
          agentId,
          sessionId: SESSION.id,
          mountId: MOUNT_TARGET.mountId,
          identity: {
            worktreePath: MOUNT_TARGET.worktreePath,
            branch: 'hl/fix-duplicate-credit',
            projectId: brandId<ProjectId>({ value: 'mock-resolve-project-payments-api' }),
          },
          isForce: false,
          confirmedOnlyOnline: null,
          confirmedRemoteSha: null,
        },
      },
    });
    render(
      <PushBanner
        sessionId={SESSION.id}
        push={push({
          phase: {
            kind: 'result',
            result: {
              tone: 'failed',
              sentence: 'Nothing was pushed.',
              failure: { output: 'boom' },
            },
          },
          fixTarget: { mountId: MOUNT_TARGET.mountId },
          retryAfterFix,
        })}
      />,
    );

    screen.getByText('An agent is fixing the push');
    expect(screen.queryByRole('button', { name: 'Let an agent fix the push' })).toBeNull();
    expect(retryAfterFix).not.toHaveBeenCalled();
    act(() => {
      store.setState({ settledBranchPushes: { [MOUNT_TARGET.mountId]: 1 } });
    });
    expect(retryAfterFix).toHaveBeenCalledOnce();
  });
});
