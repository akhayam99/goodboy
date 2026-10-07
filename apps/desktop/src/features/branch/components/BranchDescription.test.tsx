// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { BranchDescription } from './BranchDescription';

const SESSION_ID = 'session-ledger-export' as SessionId;

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: 'Retried deliveries no longer post a second credit.',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const renderDescription = ({
  body = PR.body,
  canEdit = true,
}: { readonly body?: string; readonly canEdit?: boolean } = {}) =>
  render(
    <BranchDescription
      sessionId={SESSION_ID}
      pr={{ ...PR, body }}
      detail={null}
      canEdit={canEdit}
      canRequestReview={false}
      onSelectLens={vi.fn()}
      onMutated={vi.fn()}
    />,
  );

const toggle = (): HTMLElement => screen.getByRole('button', { name: 'Description' });

describe('BranchDescription', () => {
  it('starts open with the body shown when the pull request has one', () => {
    renderDescription();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Retried deliveries no longer post a second credit.')).toBeDefined();
  });

  it('starts closed when the body is empty or only whitespace', () => {
    renderDescription({ body: '' });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    cleanup();

    renderDescription({ body: '  \n ' });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('still opens and closes by hand', () => {
    renderDescription();

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('shows Edit on the open description without going through the overflow menu', () => {
    renderDescription();

    expect(screen.getByRole('button', { name: 'Edit title' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('keeps one Edit on the closed header, which opens the description and starts editing', () => {
    renderDescription({ body: '' });

    expect(screen.queryByRole('button', { name: 'Edit title' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('offers no Edit anywhere when the pull request cannot be edited', () => {
    renderDescription({ canEdit: false });
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    cleanup();

    renderDescription({ body: '', canEdit: false });
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
  });
});
