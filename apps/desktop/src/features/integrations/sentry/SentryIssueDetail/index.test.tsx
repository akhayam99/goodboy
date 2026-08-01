// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SentryIssueDetail } from '.';

afterEach(cleanup);

describe('SentryIssueDetail', () => {
  it('surfaces the culprit, the status and the event tags, keeping breadcrumbs behind a tab', () => {
    render(
      <SentryIssueDetail
        identifier="GOODBOY-42"
        title="Request failed"
        culprit="list/culprit"
        level="error"
        status="unresolved"
        permalink="https://sentry.io/issues/42"
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
        isLoading={false}
        error={null}
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

    fireEvent.click(screen.getByRole('tab', { name: 'Breadcrumbs' }));
    expect(screen.getByText('GET /api/items')).toBeDefined();
  });
});
