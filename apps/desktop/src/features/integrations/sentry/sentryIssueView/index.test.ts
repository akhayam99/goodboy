import { describe, expect, it } from 'vitest';
import { sentryIssueView } from '.';

const listValues = {
  identifier: 'GOODBOY-42',
  title: 'List title',
  level: 'error',
  culprit: 'list/culprit',
  status: 'unresolved',
  permalink: 'https://sentry.io/issues/42',
};

describe('sentryIssueView', () => {
  it('resolves fetched detail over list values', () => {
    const frame = {
      filename: 'src/detail.ts',
      function: 'detailFrame',
      line_no: 42,
      in_app: true,
    };
    const breadcrumb = {
      category: 'http',
      message: 'GET /detail',
      level: 'info',
      timestamp: '2026-07-23T10:00:00Z',
    };
    const view = sentryIssueView({
      ...listValues,
      detail: {
        title: 'Detail title',
        culprit: 'detail/culprit',
        frames: [frame],
        tags: [
          { key: 'release', value: 'desktop@1.2.3' },
          { key: 'ignored', value: 'hidden' },
        ],
        breadcrumbs: [breadcrumb],
      },
      isLoading: false,
      error: null,
    });

    expect(view).toEqual({
      ...listValues,
      title: 'Detail title',
      culprit: 'detail/culprit',
      tags: [{ key: 'release', value: 'desktop@1.2.3' }],
      frames: [frame],
      breadcrumbs: [breadcrumb],
      breadcrumbCount: 1,
      hasBreadcrumbs: true,
    });
  });

  it('falls back to list values when detail is null', () => {
    const view = sentryIssueView({
      ...listValues,
      detail: null,
      isLoading: false,
      error: null,
    });

    expect(view).toEqual({
      ...listValues,
      tags: [],
      frames: [],
      breadcrumbs: [],
      breadcrumbCount: 0,
      hasBreadcrumbs: false,
    });
  });

  it.each([
    { isLoading: true, error: null },
    { isLoading: false, error: 'request failed' },
  ])('hides breadcrumbs for unavailable detail state', ({ isLoading, error }) => {
    const view = sentryIssueView({
      ...listValues,
      detail: {
        title: null,
        culprit: null,
        frames: [],
        breadcrumbs: [
          {
            category: 'http',
            message: 'GET /detail',
            level: 'info',
            timestamp: '2026-07-23T10:00:00Z',
          },
        ],
      },
      isLoading,
      error,
    });

    expect(view.hasBreadcrumbs).toBe(false);
    expect(view.breadcrumbCount).toBe(1);
  });
});
