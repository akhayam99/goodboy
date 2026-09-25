// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { SentryIssueDetail } from '.';

afterEach(cleanup);

const FIRST_SEEN = '2026-07-01T09:00:00Z';
const LAST_SEEN = '2026-07-23T10:00:00Z';

const BASE_PROPS = {
  identifier: 'GOODBOY-42',
  title: 'Request failed',
  culprit: 'list/culprit',
  level: 'error',
  status: 'unresolved',
  permalink: 'https://sentry.io/issues/42',
  detail: null,
  isLoading: false,
  error: null,
  summaryIsLoading: false,
  summaryError: null,
  onRetrySummary: () => {},
} as const;

describe('SentryIssueDetail', () => {
  it('surfaces the culprit, the status and the event tags, keeping breadcrumbs closed and no composer', () => {
    render(
      <SentryIssueDetail
        {...BASE_PROPS}
        detail={{
          title: 'TypeError: request failed',
          culprit: 'api/items',
          frames: [],
          tags: [
            { key: 'release', value: 'desktop@1.2.3' },
            { key: 'environment', value: 'production' },
          ],
          breadcrumbs: [
            {
              category: 'http',
              message: 'GET /api/items',
              level: 'info',
              timestamp: '2026-07-23T10:00:00Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'TypeError: request failed' })).toBeDefined();
    expect(screen.getAllByText('api/items').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open in Sentry' })).toBeDefined();
    expect(screen.getByText(/desktop@1.2.3/)).toBeDefined();
    expect(screen.getByText(/production/)).toBeDefined();
    expect(screen.queryByText('GET /api/items')).toBeNull();

    const facts = screen.getByRole('list', { name: 'Facts' });
    expect(
      within(facts)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-fact-slot')),
    ).toEqual(['weight', 'place', 'labels', 'labels']);
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Breadcrumbs/ }));
    expect(screen.getByText('GET /api/items')).toBeDefined();
  });

  it('folds events and users into one pill instead of stat cards', () => {
    render(
      <SentryIssueDetail
        {...BASE_PROPS}
        count="128"
        userCount={9}
        firstSeen={FIRST_SEEN}
        lastSeen={LAST_SEEN}
      />,
    );

    expect(screen.getByText('128 events · 9 users')).toBeDefined();
    expect(screen.queryByText('First seen')).toBeNull();
    expect(screen.getByRole('list', { name: 'Facts' }).textContent).not.toContain(
      formatAbsoluteDateTime({ iso: LAST_SEEN }),
    );
  });

  it('keeps the stack trace visible with a skeleton while the summary is still loading', () => {
    render(
      <SentryIssueDetail
        {...BASE_PROPS}
        summaryIsLoading
        detail={{
          title: null,
          culprit: null,
          frames: [{ filename: 'items.ts', function: 'loadItems', line_no: 12, in_app: true }],
          tags: [],
          breadcrumbs: [],
        }}
      />,
    );

    expect(screen.getByRole('status', { name: 'Loading Sentry issue details' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Request failed' })).toBeDefined();
    expect(screen.getByText(/loadItems/)).toBeDefined();
  });

  it('keeps the stack trace visible with a retryable error strip when the summary fetch fails', () => {
    const onRetrySummary = vi.fn();
    render(
      <SentryIssueDetail
        {...BASE_PROPS}
        summaryError="invalid response shape"
        onRetrySummary={onRetrySummary}
        detail={{
          title: null,
          culprit: null,
          frames: [{ filename: 'items.ts', function: 'loadItems', line_no: 12, in_app: true }],
          tags: [],
          breadcrumbs: [],
        }}
      />,
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Request failed' })).toBeDefined();
    expect(screen.getByText(/loadItems/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetrySummary).toHaveBeenCalledOnce();
  });
});
