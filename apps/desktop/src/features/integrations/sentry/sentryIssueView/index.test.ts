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

const emptyCounts = {
  count: null,
  userCount: null,
  firstSeen: null,
  lastSeen: null,
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
      ...emptyCounts,
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
      ...emptyCounts,
      tags: [],
      frames: [],
      breadcrumbs: [],
      breadcrumbCount: 0,
      hasBreadcrumbs: false,
    });
  });

  it('carries the issue counts and seen timestamps through untouched', () => {
    const view = sentryIssueView({
      ...listValues,
      count: '128',
      userCount: 9,
      firstSeen: '2026-07-01T09:00:00Z',
      lastSeen: '2026-07-23T10:00:00Z',
      detail: null,
      isLoading: false,
      error: null,
    });

    expect(view.count).toBe('128');
    expect(view.userCount).toBe(9);
    expect(view.firstSeen).toBe('2026-07-01T09:00:00Z');
    expect(view.lastSeen).toBe('2026-07-23T10:00:00Z');
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
