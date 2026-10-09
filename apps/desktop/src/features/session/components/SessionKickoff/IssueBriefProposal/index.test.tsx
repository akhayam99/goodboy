// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { IssueBriefProposal } from './index';

const SOURCE: IssueBriefSource = {
  provider: 'linear',
  externalId: 'issue-412',
  identifier: 'ACME-412',
  title: 'Checkout fails when the promo code field is empty',
  body: 'x'.repeat(3_480),
  url: 'https://linear.app/acme/issue/ACME-412',
  noun: 'issue',
};

const ROUTE = { providerId: 'anthropic', model: 'haiku-4.5' } as const;

const READY: IssueBriefEntry = {
  status: 'ready',
  signature: 'sig',
  route: ROUTE,
  brief: {
    title: 'Fix checkout when the promo code is empty',
    goal: 'Paying with an empty promo code must go through without calling applyPromo.',
    acceptance: ['Empty promo field pays normally'],
  },
  durationMs: 4_000,
  costUsd: 0,
};

type RenderParams = {
  readonly entry: IssueBriefEntry | null;
  readonly isBriefShown?: boolean;
  readonly hasBrief?: boolean;
};

const renderProposal = ({ entry, isBriefShown = false, hasBrief = false }: RenderParams) => {
  const spies = {
    onTitleChange: vi.fn(),
    onUseBrief: vi.fn(),
    onUseIssueText: vi.fn(),
    onRetry: vi.fn(),
  };
  render(
    <IssueBriefProposal
      source={SOURCE}
      entry={entry}
      title="Checkout fails when the promo code field is empty"
      isBriefShown={isBriefShown}
      hasBrief={hasBrief}
      {...spies}
    />,
  );
  return spies;
};

afterEach(cleanup);

describe('IssueBriefProposal', () => {
  it('shows an editable title and says the brief is being written, with no gate', () => {
    const spies = renderProposal({
      entry: { status: 'loading', signature: 'sig', route: ROUTE },
    });

    const title = screen.getByRole('textbox', { name: 'Brief title' });
    fireEvent.change(title, { target: { value: 'Fix the promo field' } });
    expect(spies.onTitleChange).toHaveBeenCalledWith('Fix the promo field');
    expect(screen.getByRole('status').textContent).toBe('Writing a brief');
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Brief from ACME-412' }).hasAttribute('aria-busy'),
    ).toBe(true);
  });

  it('offers the issue text while the brief is shown and the brief once it is not', () => {
    const shown = renderProposal({ entry: READY, isBriefShown: true, hasBrief: true });

    fireEvent.click(screen.getByRole('button', { name: 'Use the issue text' }));
    expect(shown.onUseIssueText).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
    cleanup();

    const hidden = renderProposal({ entry: READY, isBriefShown: false, hasBrief: true });

    fireEvent.click(screen.getByRole('button', { name: 'Use brief' }));
    expect(hidden.onUseBrief).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Use the issue text' })).toBeNull();
  });

  it('names the model that wrote the brief', () => {
    renderProposal({ entry: READY, isBriefShown: true, hasBrief: true });

    expect(screen.getByText(/4s/)).toBeDefined();
  });

  it('keeps the issue text and offers Retry when the brief failed', () => {
    const spies = renderProposal({
      entry: {
        status: 'failed',
        signature: 'sig',
        route: ROUTE,
        failure: 'provider_failed',
        detail: null,
      },
    });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't write a brief for ACME-412");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(spies.onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
  });

  it('says so when no model is free to write a brief', () => {
    renderProposal({ entry: { status: 'unavailable', signature: 'sig' } });

    expect(
      screen.getByText('A brief needs a free model, so this is the issue text as it is.'),
    ).toBeDefined();
    expect(screen.getByText('The full issue stays linked to this session.')).toBeDefined();
  });
});
