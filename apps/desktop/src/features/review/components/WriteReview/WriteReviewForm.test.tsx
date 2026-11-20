// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type PrReviewDraft,
  type SessionExternalTask,
  type SessionId,
} from '@goodboy/types';
import type { ReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import type { MountReview } from '../../mountReviewOf';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WriteReviewForm } from './WriteReviewForm';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION_ID = brandId<SessionId>({ value: 'session-write-review' });
const CREATED_AT = brandId<IsoDateTime>({ value: '2026-09-04T14:00:00.000Z' });

const draftOf = (id: string, path: string, line: number, body: string): PrReviewDraft => ({
  id,
  sessionId: SESSION_ID,
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
  path,
  line,
  startLine: null,
  side: 'new',
  body,
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: CREATED_AT,
});

const PAYMENTS: ReviewTarget = {
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
};

const LEDGER: ReviewTarget = { provider: 'gitlab', repo: 'harborline/ledger-core', prNumber: 90 };

type LinkParams = {
  readonly target: ReviewTarget;
};

const linkOf = ({ target }: LinkParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: target.provider,
  externalId: String(target.prNumber),
  identifier: `#${target.prNumber}`,
  url:
    target.provider === 'github'
      ? `https://github.com/${target.repo}/pull/${target.prNumber}`
      : `https://gitlab.com/${target.repo}/-/merge_requests/${target.prNumber}`,
  title: 'Stop retried webhooks posting a second credit',
  createdAt: CREATED_AT,
});

const ONE_REVIEW: MountReview = {
  kind: 'review',
  target: PAYMENTS,
  choices: [PAYMENTS],
  hostUrl: null,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [linkOf({ target: PAYMENTS })] } });
});

afterEach(cleanup);

type MountParams = {
  readonly review?: MountReview;
  readonly drafts?: ReadonlyArray<PrReviewDraft>;
};

const mount = async ({ review = ONE_REVIEW, drafts = [] }: MountParams = {}): Promise<void> => {
  render(
    <ToastProvider>
      <WriteReviewForm sessionId={SESSION_ID} review={review} drafts={drafts} />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('Write review as a form', () => {
  it('asks for something to send before an empty comment review', async () => {
    await mount();

    expect(screen.getByRole('button', { name: /^Submit comments/ }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: /^Approve/ }).hasAttribute('disabled')).toBe(false);
  });

  it('lists the line comments, then the verdict and summary, and submits once on the button', async () => {
    const publishPrReview = vi.fn(async () => ({
      published: 2,
      stale: [],
      failed: [],
      mismatched: [],
    }));
    const setPullRequestMode = vi.fn();
    const drafts = [
      draftOf('d1', 'src/ledger/postCredit.ts', 18, 'This could take the transaction.'),
      draftOf('d2', 'src/webhooks/retryPolicy.ts', 55, 'Nit: name the constant.'),
    ];
    useAppStore.setState({
      reviewDrafts: { [SESSION_ID]: drafts },
      publishPrReview: publishPrReview as unknown as StoreState['publishPrReview'],
      loadReviewDrafts: vi.fn(async () => undefined),
      setPullRequestMode: setPullRequestMode as unknown as StoreState['setPullRequestMode'],
    });
    await mount({ drafts });

    const form = screen.getByRole('region', { name: 'Your review' });
    expect(within(form).getByText('src/ledger/postCredit.ts:18')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Request changes' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Summary' }), {
      target: { value: 'Two small notes.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Request changes/ }));

    await waitFor(() => expect(publishPrReview).toHaveBeenCalledOnce());
    expect(publishPrReview).toHaveBeenCalledWith(SESSION_ID, {
      verdict: 'request_changes',
      body: 'Two small notes.',
      target: PAYMENTS,
      mountId: null,
    });
    await waitFor(() =>
      expect(setPullRequestMode).toHaveBeenCalledWith({ sessionId: SESSION_ID, mode: 'overview' }),
    );
    expect(document.querySelector('[data-slot="pane-dock"]')).toBeNull();
  });

  it('edits a line comment in place and deletes one with undo', async () => {
    const updateReviewDraft = vi.fn(async () => undefined);
    const discardReviewDraft = vi.fn(async () => undefined);
    const drafts = [draftOf('d1', 'src/ledger/postCredit.ts', 18, 'Take the transaction.')];
    useAppStore.setState({
      reviewDrafts: { [SESSION_ID]: drafts },
      updateReviewDraft: updateReviewDraft as unknown as StoreState['updateReviewDraft'],
      discardReviewDraft: discardReviewDraft as unknown as StoreState['discardReviewDraft'],
    });
    await mount({ drafts });

    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    const box = await screen.findByRole('textbox', { name: 'Edit comment' });
    fireEvent.change(box, { target: { value: 'Reuse the caller transaction.' } });
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', metaKey: true });
    await waitFor(() =>
      expect(updateReviewDraft).toHaveBeenCalledWith('d1', 'Reuse the caller transaction.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    await waitFor(() => expect(discardReviewDraft).toHaveBeenCalledWith('d1'));
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeDefined();
  });

  it('names the host and the request the review goes to', async () => {
    await mount();

    screen.getByText('GitHub shows it on payments-api #318 as one review.');
    expect(screen.queryByRole('tablist', { name: 'Review goes to' })).toBeNull();
  });

  it('asks which request when the page holds more than one', async () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [linkOf({ target: PAYMENTS }), linkOf({ target: LEDGER })],
      },
    });
    await mount({ review: { ...ONE_REVIEW, choices: [PAYMENTS, LEDGER] } });

    const choice = screen.getByRole('tablist', { name: 'Review goes to' });
    within(choice).getByRole('tab', { name: 'payments-api #318' });
    fireEvent.click(within(choice).getByRole('tab', { name: 'ledger-core !90' }));

    expect(useAppStore.getState().reviewSubmission[SESSION_ID]?.chosenTarget).toMatchObject(LEDGER);
  });

  it('keeps the line comments and the summary when the host refuses the review', async () => {
    const drafts = [draftOf('d1', 'src/ledger/postCredit.ts', 18, 'Take the transaction.')];
    const [first] = drafts;
    if (first === undefined) {
      throw new Error('draft missing');
    }
    const publishPrReview = vi.fn<StoreState['publishPrReview']>(async () => ({
      published: 0,
      stale: [],
      failed: [{ draft: first, error: 'GitHub refused the review.' }],
      mismatched: [],
    }));
    useAppStore.setState({
      reviewDrafts: { [SESSION_ID]: drafts },
      publishPrReview,
      loadReviewDrafts: vi.fn(async () => undefined),
    });
    await mount({ drafts });

    fireEvent.change(screen.getByRole('textbox', { name: 'Summary' }), {
      target: { value: 'One note.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Submit comments/ }));

    await screen.findByText('GitHub refused the review.');
    expect(useAppStore.getState().reviewSubmission[SESSION_ID]?.summary).toBe('One note.');
    expect(useAppStore.getState().reviewDrafts[SESSION_ID]?.[0]?.status).toBe('draft');
    screen.getByText('src/ledger/postCredit.ts:18');
  });
});
