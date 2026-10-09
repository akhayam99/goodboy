// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ScribeProposalState } from '../../hooks/useScribeProposal';

const h = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../../lib/editor', () => ({ openUrl: h.openUrl }));

import { ScribeProposalView } from '.';

const LONG_BODY = Array.from({ length: 9 }, (_, index) => `- change ${index + 1}`).join('\n');

const proposal = {
  title: 'Guard settlement postings',
  body: 'Retried batches no longer post twice.',
  changelogEntry: null,
};

const view = ({
  state,
  canRetry = false,
  isCompact = false,
  body = proposal.body,
  onRetry = vi.fn(),
}: {
  readonly state: ScribeProposalState | null;
  readonly canRetry?: boolean;
  readonly isCompact?: boolean;
  readonly body?: string;
  readonly onRetry?: () => void;
}) =>
  render(
    <ScribeProposalView
      proposal={{ ...proposal, body }}
      state={state}
      canRetry={canRetry}
      isCompact={isCompact}
      hasHeader
      onRetry={onRetry}
    />,
  );

beforeEach(() => {
  h.openUrl.mockClear();
});

afterEach(cleanup);

describe('ScribeProposalView', () => {
  it('shows the title, the body and that the draft is being created', () => {
    view({ state: { kind: 'creating' } });

    expect(screen.getByRole('region', { name: 'Pull request text' })).toBeDefined();
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Retried batches no longer post twice.')).toBeDefined();
    expect(screen.getByText('Creating')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('links the number of the request it opened', () => {
    view({
      state: {
        kind: 'created',
        number: 418,
        url: 'https://github.com/harborline/ledger-core/pull/418',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Created #418' }));

    expect(h.openUrl).toHaveBeenCalledExactlyOnceWith(
      'https://github.com/harborline/ledger-core/pull/418',
    );
  });

  it('names the action, hides the reason behind Details and offers Retry when a step failed', () => {
    const onRetry = vi.fn();
    view({
      state: { kind: 'failed', reason: "Couldn't push fix/ledger-postings: denied" },
      canRetry: true,
      onRetry,
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't write the pull request text");
    expect(alert.textContent).toContain('The text is kept, so you can try again.');
    expect(alert.textContent).not.toContain('denied');
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(alert.textContent).toContain("Couldn't push fix/ledger-postings: denied");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Create PR' })).toBeNull();
  });

  it('shows the failure with no Retry when the text cannot be sent again', () => {
    view({ state: { kind: 'failed', reason: 'denied' }, canRetry: false });

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('offers Create PR when nothing was opened yet', () => {
    view({ state: { kind: 'idle' }, canRetry: true });

    expect(screen.getByText('Not opened yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create PR' })).toBeDefined();
  });

  it('marks a text a later answer replaced and offers nothing on it', () => {
    view({ state: null });

    expect(screen.getByText('Earlier version')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('folds a long body in the transcript and opens it on Show all', () => {
    view({ state: { kind: 'creating' }, isCompact: true, body: LONG_BODY });

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

    expect(screen.getByRole('button', { name: 'Show less' })).toBeDefined();
  });

  it('never folds the body in the Brief', () => {
    view({ state: { kind: 'creating' }, isCompact: false, body: LONG_BODY });

    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });
});
