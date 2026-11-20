// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type PrReviewDraft, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { MountReview } from '../../mountReviewOf';
import { ReviewPanelButton } from './ReviewPanelButton';

const REVIEW_PANEL_LABEL = 'Review changes';

const SESSION_ID = brandId<SessionId>({ value: 'session-review-panel' });
const CREATED_AT = brandId<IsoDateTime>({ value: '2026-09-04T14:00:00.000Z' });

const draftOf = (id: string, line: number): PrReviewDraft => ({
  id,
  sessionId: SESSION_ID,
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
  path: 'src/webhooks/retry.ts',
  line,
  startLine: null,
  side: 'new',
  body: 'Cap the Retry-After wait at fifteen minutes',
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: CREATED_AT,
});

const TARGET = { provider: 'github', repo: 'harborline/payments-api', prNumber: 318 } as const;

const REVIEW: MountReview = { kind: 'review', target: TARGET, choices: [TARGET], hostUrl: null };

const DRAFTS = [draftOf('d1', 12), draftOf('d2', 30)];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    reviewDrafts: { [SESSION_ID]: DRAFTS },
    sessionExternalTasks: {
      [SESSION_ID]: [
        {
          sessionId: SESSION_ID,
          provider: 'github',
          externalId: '318',
          identifier: '#318',
          url: 'https://github.com/harborline/payments-api/pull/318',
          title: 'Stop retried webhooks posting a second credit',
          createdAt: CREATED_AT,
        },
      ],
    },
  });
});

afterEach(cleanup);

const mount = async (): Promise<void> => {
  render(
    <ToastProvider>
      <ReviewPanelButton sessionId={SESSION_ID} review={REVIEW} drafts={DRAFTS} />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('the Review panel from the diff toolbar', () => {
  it('counts the line comments on its button and opens the verdict, summary and submit under it', async () => {
    await mount();
    const trigger = screen.getByRole('button', { name: /^Review/ });
    expect(trigger.textContent).toContain('2');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    const panel = await screen.findByRole('dialog', { name: REVIEW_PANEL_LABEL });
    expect(within(panel).getByRole('tablist', { name: 'Review verdict' })).toBeDefined();
    expect(within(panel).getByRole('textbox')).toBeDefined();
    expect(within(panel).getByRole('button', { name: /^Submit/ })).toBeDefined();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Esc and gives focus back to the Review button', async () => {
    await mount();
    const trigger = screen.getByRole('button', { name: /^Review/ });
    trigger.focus();
    fireEvent.click(trigger);
    const panel = await screen.findByRole('dialog', { name: REVIEW_PANEL_LABEL });

    fireEvent.keyDown(panel, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: REVIEW_PANEL_LABEL })).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);
  });
});
