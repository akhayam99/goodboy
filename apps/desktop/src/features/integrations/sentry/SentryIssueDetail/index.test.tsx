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

const termValuePairs = (panel: HTMLElement) => {
  return Object.fromEntries(
    within(panel)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent ?? '']),
  );
};

describe('SentryIssueDetail', () => {
  it('surfaces the culprit, the status and the event tags, keeping breadcrumbs behind a tab', () => {
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
    expect(screen.getByText('api/items')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open in Sentry/ }).getAttribute('href')).toBe(
      'https://sentry.io/issues/42',
    );
    expect(screen.getByText(/desktop@1.2.3/)).toBeDefined();
    expect(screen.getByText(/production/)).toBeDefined();
    expect(screen.queryByText('GET /api/items')).toBeNull();

    const panel = screen.getByTestId('detail-properties');
    expect(
      within(panel)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Culprit', 'Status', 'release', 'environment']);

    fireEvent.click(screen.getByRole('tab', { name: 'Breadcrumbs 1' }));
    expect(screen.getByText('GET /api/items')).toBeDefined();
  });

  it('pins events, users, first seen and last seen to their own distinct values', () => {
    render(
      <SentryIssueDetail
        {...BASE_PROPS}
        count="128"
        userCount={9}
        firstSeen={FIRST_SEEN}
        lastSeen={LAST_SEEN}
      />,
    );

    const panel = screen.getByTestId('detail-properties');
    const pairs = termValuePairs(panel);
    expect(pairs.Events).toBe('128');
    expect(pairs.Users).toBe('9');
    expect(pairs['First seen']).toBe(formatAbsoluteDateTime({ iso: FIRST_SEEN }));
    expect(pairs['Last seen']).toBe(formatAbsoluteDateTime({ iso: LAST_SEEN }));
    expect(pairs.Events).not.toBe(pairs.Users);
    expect(pairs['First seen']).not.toBe(pairs['Last seen']);
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
