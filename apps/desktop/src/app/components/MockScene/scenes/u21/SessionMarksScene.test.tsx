// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SessionMarksScene } from './SessionMarksScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type Mark = {
  readonly title: string;
  readonly tone: string;
  readonly state: string;
  readonly words: string;
};

const MARKS: ReadonlyArray<Mark> = [
  {
    title: 'Billing export fails on large files',
    tone: 'danger',
    state: 'failed',
    words: 'An agent stopped on an error',
  },
  {
    title: 'Stop notify-relay retries on a 409',
    tone: 'danger',
    state: 'failed',
    words: 'Checks failing',
  },
  {
    title: 'Pick the retry window for webhooks',
    tone: 'warning',
    state: 'question',
    words: '1 question for you',
  },
  {
    title: 'Paginate the payments list',
    tone: 'success',
    state: 'approved',
    words: 'Approved, ready to merge',
  },
  {
    title: 'Move the ledger export to a queue',
    tone: 'warning',
    state: 'alert',
    words: 'Changes requested',
  },
  {
    title: 'Add idempotency keys to payments-api',
    tone: 'warning',
    state: 'question',
    words: '1 comment needs you',
  },
  {
    title: 'Backfill the settlement dates',
    tone: 'warning',
    state: 'alert',
    words: "1 comment it couldn't fix",
  },
  {
    title: 'Write the notify-relay digest',
    tone: 'warning',
    state: 'approval',
    words: 'Waiting for your approval',
  },
  {
    title: 'Plan the Cascadia onboarding',
    tone: 'warning',
    state: 'approval',
    words: 'The plan waits for your approval',
  },
  {
    title: 'Review the Acme import mapper',
    tone: 'info',
    state: 'marker',
    words: 'New reply',
  },
  {
    title: 'Tune the rate limiter',
    tone: 'warning',
    state: 'question',
    words: '1 question for you',
  },
  {
    title: 'Ship the refund webhook',
    tone: 'danger',
    state: 'failed',
    words: 'Checks failing',
  },
  {
    title: 'Add a Harborline export schema',
    tone: 'neutral',
    state: 'marker',
    words: 'In review',
  },
  {
    title: 'Land the Harborline webhook retries',
    tone: 'primary',
    state: 'merging',
    words: 'In merge queue',
  },
  {
    title: 'Northwind CSV export',
    tone: 'merged',
    state: 'finished',
    words: 'Done',
  },
];

const rowOf = (title: string): HTMLElement => screen.getByRole('button', { name: title });

describe('the session marks scene', () => {
  it.each(MARKS.map((mark) => [mark.title, mark] as const))(
    'marks "%s" by what it means',
    async (_title, mark) => {
      render(
        <ToastProvider>
          <SessionMarksScene />
        </ToastProvider>,
      );
      await waitFor(() => expect(rowOf(mark.title)).toBeDefined());
      const row = rowOf(mark.title);
      const node = row.querySelector('[role="img"]');

      expect(row.querySelector('[data-node-tone]')?.getAttribute('data-node-tone')).toBe(mark.tone);
      expect(node?.getAttribute('data-node-state')).toBe(mark.state);
      expect((node?.getAttribute('aria-label') ?? '').replace(/, unseen$/, '')).toBe(mark.words);
    },
  );

  it('opens the session on its Overview, not on the loading skeleton', async () => {
    render(
      <ToastProvider>
        <SessionMarksScene />
      </ToastProvider>,
    );

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Refactor the CSV mapper',
    });
    expect(title).toBeDefined();
    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
  });

  it('draws the unread dot on the unread reply and nowhere else', async () => {
    render(
      <ToastProvider>
        <SessionMarksScene />
      </ToastProvider>,
    );
    await waitFor(() => expect(rowOf('Review the Acme import mapper')).toBeDefined());

    const unseen = screen
      .getAllByRole('img', { hidden: true })
      .filter((node) => (node.getAttribute('aria-label') ?? '').endsWith(', unseen'));
    expect(unseen.map((node) => node.getAttribute('aria-label'))).toEqual(['New reply, unseen']);
  });

  it('keeps red for the error and failing checks only', async () => {
    render(
      <ToastProvider>
        <SessionMarksScene />
      </ToastProvider>,
    );
    await waitFor(() => expect(rowOf('Billing export fails on large files')).toBeDefined());

    const red = Array.from(document.querySelectorAll('[data-node-tone="danger"]')).map(
      (node) => node.closest('button')?.textContent?.replace(/^!/, '') ?? '',
    );
    expect(red.sort()).toEqual(
      [
        'Billing export fails on large files',
        'Ship the refund webhook',
        'Stop notify-relay retries on a 409',
      ].sort(),
    );
  });
});
