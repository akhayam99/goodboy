// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));
vi.mock('../../../../shared/lib/editor', () => ({ openUrl }));

import { HostRequestSummary } from './HostRequestSummary';

afterEach(cleanup);

const sourceOf = ({
  kind,
  label,
  url,
}: {
  readonly kind: 'gitlab' | 'bitbucket';
  readonly label: string;
  readonly url: string;
}): ActiveReviewSource =>
  ({
    kind,
    entry: {
      key: `${kind}:1`,
      kind,
      mountId: null,
      projectId: null,
      number: 57,
      label,
      url,
      openCount: 2,
    },
    mountId: null,
    projectId: null,
    prNumber: 57,
    url,
    repo: null,
    headBranch: null,
    comments: [],
    hasDetail: true,
    isLoading: false,
    error: null,
    fetchedAt: null,
    capabilities: REVIEW_SOURCE_CAPABILITIES[kind],
  }) as ActiveReviewSource;

describe('the pull request tab on a host without an adapter yet', () => {
  it('names the merge request and shows each write control disabled with its reason', () => {
    render(
      <HostRequestSummary
        source={sourceOf({
          kind: 'gitlab',
          label: 'notify-relay !57',
          url: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Merge request on GitLab' })).toBeDefined();
    for (const name of ['Edit title', 'Edit description', 'Request review', 'Mark ready']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(
      screen.getByText('Goodboy cannot edit the title of a merge request on GitLab yet'),
    ).toBeDefined();
    expect(screen.getByText('Set by the project')).toBeDefined();
  });

  it('opens the request on its host', () => {
    render(
      <HostRequestSummary
        source={sourceOf({
          kind: 'gitlab',
          label: 'notify-relay !57',
          url: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open on GitLab/ }));

    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('/merge_requests/57'));
  });

  it('leaves out the draft control where the host has no drafts', () => {
    render(
      <HostRequestSummary
        source={sourceOf({
          kind: 'bitbucket',
          label: 'storefront-web #12',
          url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12',
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pull request on Bitbucket' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark ready' })).toBeNull();
    expect(screen.queryByText('Bitbucket has no draft pull requests')).toBeNull();
    expect(screen.getByRole('button', { name: 'Request review' })).toBeDefined();
  });
});
