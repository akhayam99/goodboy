// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    words: 'An agent failed',
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
    words: 'Needs permission',
  },
  {
    title: 'Plan the Cascadia onboarding',
    tone: 'warning',
    state: 'approval',
    words: 'The plan needs approval',
  },
  {
    title: 'Review the Acme import mapper',
    tone: 'info',
    state: 'dot',
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
    title: 'Land the Harborline webhook retries',
    tone: 'primary',
    state: 'merging',
    words: 'In merge queue',
  },
];

const openSessions = async (): Promise<HTMLElement> => {
  render(
    <ToastProvider>
      <SessionMarksScene />
    </ToastProvider>,
  );
  const trigger = await screen.findByRole('button', { name: 'Sessions' });
  fireEvent.click(trigger);
  return screen.findByRole('listbox', { name: 'Sessions' });
};

const rowOf = (list: HTMLElement, title: string): HTMLElement => {
  const row = within(list)
    .getAllByRole('option')
    .find((option) => option.textContent?.startsWith(title) === true);
  if (row === undefined) {
    throw new Error(`Sessions has no row ${title}`);
  }
  return row;
};

describe('the session marks scene', () => {
  it.each(MARKS.map((mark) => [mark.title, mark] as const))(
    'marks "%s" by what it means in Sessions',
    async (_title, mark) => {
      const list = await openSessions();
      const node = rowOf(list, mark.title).querySelector('[role="img"]');

      expect(
        node?.getAttribute('data-status-state') ?? node?.getAttribute('data-status-mark'),
      ).toBe(mark.state);
      expect((node?.getAttribute('aria-label') ?? '').replace(/, unseen$/, '')).toBe(mark.words);
    },
  );

  it('opens the session on its Overview, not on the loading skeleton', async () => {
    render(
      <ToastProvider>
        <SessionMarksScene />
      </ToastProvider>,
    );

    const title = await screen.findByTestId('overview-title');
    expect(title.closest('h1')).not.toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
  });

  it('keeps an empty slot on a row with nothing to say, so the titles stay aligned', async () => {
    const list = await openSessions();
    const row = rowOf(list, 'Add a Harborline export schema');

    expect(row.querySelector('[role="img"]')).toBeNull();
    expect(row.querySelector('[data-status-mark="empty"]')).not.toBeNull();
  });

  it('counts the sessions that need you on the Board of the rail alone, red as one is broken', async () => {
    await openSessions();

    const board = document.querySelector('[data-shell-rail-item="board"]');
    const mark = board
      ?.closest('[data-slot="shell-rail-item"]')
      ?.querySelector('[data-slot="rail-mark"]');
    expect(mark?.textContent).toBe('9+');
    expect(mark?.querySelector('[data-count-badge]')?.getAttribute('data-count-badge')).toBe(
      'danger',
    );
    expect(document.querySelector('[data-top-bar] [data-now-needs-you]')).toBeNull();
  });
});
