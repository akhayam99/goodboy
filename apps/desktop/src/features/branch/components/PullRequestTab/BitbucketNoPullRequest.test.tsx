// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BitbucketNoPullRequest } from './BitbucketNoPullRequest';

afterEach(cleanup);

describe('BitbucketNoPullRequest', () => {
  it('points at Bitbucket and says Goodboy follows the request when connected', () => {
    render(
      <BitbucketNoPullRequest
        url="https://bitbucket.org/harborline/payments-api/pull-requests/new"
        isConnected
      />,
    );

    expect(
      screen.getByText('Create the pull request on Bitbucket and Goodboy follows it'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Open Bitbucket/ })).toBeDefined();
  });

  it('asks to connect Bitbucket when it is not connected', () => {
    render(
      <BitbucketNoPullRequest
        url="https://bitbucket.org/harborline/payments-api/pull-requests/new"
        isConnected={false}
      />,
    );

    expect(screen.getByText(/Connect Bitbucket in Settings/)).toBeDefined();
  });
});
