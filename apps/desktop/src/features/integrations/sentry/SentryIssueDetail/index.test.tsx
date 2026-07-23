// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SentryIssueDetail } from '.';

afterEach(cleanup);

describe('SentryIssueDetail', () => {
  it('surfaces event tags and keeps breadcrumbs collapsed', () => {
    render(
      <SentryIssueDetail
        identifier="GOODBOY-42"
        title="Request failed"
        culprit="api/items"
        level="error"
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

    expect(screen.getByText(/desktop@1.2.3/)).toBeDefined();
    expect(screen.getByText(/production/)).toBeDefined();
    expect(screen.getByText('Breadcrumbs (1)').parentElement?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('GET /api/items')).toBeDefined();
  });
});
