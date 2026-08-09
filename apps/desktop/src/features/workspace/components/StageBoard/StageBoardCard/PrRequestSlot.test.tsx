// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getLinkedRequest } from './getLinkedRequest';
import { PrRequestSlot } from './PrRequestSlot';

afterEach(cleanup);

const noRequest = getLinkedRequest({ pullRequest: null, mergeRequest: null });

describe('PrRequestSlot', () => {
  it('shows a skeleton chip, and no pull request claim, while GitHub is still being checked', () => {
    const { container } = render(
      <PrRequestSlot
        linkedRequest={noRequest}
        isGitlab={false}
        prFetchState="unknown"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
      'Checking GitHub for a pull request',
    );
    expect(container.querySelector('[class*="animate-pulse"]')).not.toBeNull();
    expect(screen.queryByLabelText(/No pull request/)).toBeNull();
  });

  it('renders nothing once the fetch landed and there is genuinely no pull request', () => {
    const { container } = render(
      <PrRequestSlot
        linkedRequest={noRequest}
        isGitlab={false}
        prFetchState="known"
        onOpen={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('marks the slot offline, without a skeleton, when GitHub could not be reached', () => {
    const { container } = render(
      <PrRequestSlot
        linkedRequest={noRequest}
        isGitlab={false}
        prFetchState="unreachable"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Could not reach GitHub, will retry')).toBeDefined();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
  });

  it('shows the real chip once a pull request is known, whatever the fetch state says', () => {
    const linked = getLinkedRequest({
      pullRequest: { number: 42, state: 'open' } as never,
      mergeRequest: null,
    });
    const { container } = render(
      <PrRequestSlot
        linkedRequest={linked}
        isGitlab={false}
        prFetchState="unreachable"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'In review · #42, open in GitHub',
    );
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
  });
});
