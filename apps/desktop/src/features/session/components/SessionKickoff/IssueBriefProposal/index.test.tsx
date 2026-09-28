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
    acceptance: ['Empty promo field pays normally', 'Invalid code still shows the inline error'],
  },
  durationMs: 4_000,
  costUsd: 0,
};

const GOAL = [
  'Paying with an empty promo code must go through without calling applyPromo.',
  'Done when:\n- Empty promo field pays normally\n- Invalid code still shows the inline error',
  'Issue: ACME-412 https://linear.app/acme/issue/ACME-412',
].join('\n\n');

const handlers = () => ({
  onApply: vi.fn(),
  onUseTitle: vi.fn(),
  onUseIssueText: vi.fn(),
  onRetry: vi.fn(),
  onDismiss: vi.fn(),
});

type RenderParams = {
  readonly entry: IssueBriefEntry | null;
  readonly isTitleLocked?: boolean;
};

const renderProposal = ({ entry, isTitleLocked = false }: RenderParams) => {
  const spies = handlers();
  render(
    <IssueBriefProposal
      source={SOURCE}
      entry={entry}
      verbatimGoal="[ACME-412] Checkout fails when the promo code field is empty"
      isTitleLocked={isTitleLocked}
      {...spies}
    />,
  );
  return spies;
};

afterEach(cleanup);

describe('IssueBriefProposal', () => {
  it('reads the issue while the brief loads and still offers the issue text', () => {
    const spies = renderProposal({
      entry: { status: 'loading', signature: 'sig', route: ROUTE },
    });

    expect(screen.getByRole('status', { name: 'Writing a brief for ACME-412' })).toBeDefined();
    expect(screen.getByText('Reading ACME-412, 3,480 characters')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Use issue text' }));
    expect(spies.onUseIssueText).toHaveBeenCalledOnce();
  });

  it('applies the brief title and the composed goal', () => {
    const spies = renderProposal({ entry: READY });

    expect(screen.getByRole('heading', { name: READY.brief.title })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Done when' }).children).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Use as title' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use brief' }));

    expect(spies.onApply).toHaveBeenCalledWith({ title: READY.brief.title, goal: GOAL });
  });

  it('offers the title on its own when the session was already renamed', () => {
    const spies = renderProposal({ entry: READY, isTitleLocked: true });

    fireEvent.click(screen.getByRole('button', { name: 'Use as title' }));

    expect(spies.onUseTitle).toHaveBeenCalledWith({ title: READY.brief.title });
  });

  it('edits the brief inline and saves the edited text', () => {
    const spies = renderProposal({ entry: READY });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Brief title' }), {
      target: { value: 'Let empty promo codes pay' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Brief goal' }), {
      target: { value: 'Empty promo codes pay.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spies.onApply).toHaveBeenCalledWith({
      title: 'Let empty promo codes pay',
      goal: 'Empty promo codes pay.',
    });
  });

  it('shows a failure inline with Retry', () => {
    const spies = renderProposal({
      entry: {
        status: 'failed',
        signature: 'sig',
        route: ROUTE,
        failure: 'missing_title',
        detail: null,
      },
    });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't write a brief for ACME-412");
    expect(screen.getByText('The model answered without a title.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(spies.onRetry).toHaveBeenCalledOnce();
  });

  it('falls back to the issue text without an error when no model is free', () => {
    const spies = renderProposal({ entry: { status: 'unavailable', signature: 'sig' } });

    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use issue text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(spies.onUseIssueText).toHaveBeenCalledOnce();
    expect(spies.onDismiss).toHaveBeenCalledOnce();
  });
});
