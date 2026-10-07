// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MountId, SessionId } from '@goodboy/types';
import type {
  MountRequestView,
  MountRowView,
} from '../../../../../store/slices/project-mounts/mountRowModel';

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { readonly openMountRequest: () => Promise<never> }) => T) =>
    selector({ openMountRequest: () => new Promise<never>(() => undefined) }),
}));

import { MountRequestLink } from './MountRequestLink';

const SESSION = 'session-1' as SessionId;

const requestOf = (over: Partial<MountRequestView>): MountRequestView => ({
  provider: 'github',
  identity: null,
  number: 9914,
  state: 'open',
  isDraft: false,
  checks: 'success',
  reviewDecision: 'review_required',
  url: 'https://github.com/harborline/payments-api/pull/9914',
  title: 'Encode signup intents as opaque aliases',
  label: 'PR #9914',
  ...over,
});

const rowOf = (request: MountRequestView): MountRowView =>
  ({ mountId: 'mount-1' as MountId, request }) as unknown as MountRowView;

const renderLink = (request: MountRequestView) =>
  render(<MountRequestLink sessionId={SESSION} row={rowOf(request)} label="payments-api" />);

afterEach(cleanup);

describe('MountRequestLink', () => {
  it('reads a closed pull request as Closed even when GitHub still flags it as a draft', () => {
    renderLink(requestOf({ state: 'closed', isDraft: true }));

    expect(screen.getByText('Closed')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
    expect(screen.getByLabelText('Closed')).toBeDefined();
  });

  it('reads a merged pull request as Merged even when GitHub still flags it as a draft', () => {
    renderLink(requestOf({ state: 'merged', isDraft: true }));

    expect(screen.getByText('Merged')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('reads a live draft as Draft and a queued pull request as Queued', () => {
    const { unmount } = renderLink(requestOf({ state: 'open', isDraft: true }));
    expect(screen.getByText('Draft')).toBeDefined();
    unmount();

    renderLink(requestOf({ state: 'queued', isDraft: false }));
    expect(screen.getByText('Queued')).toBeDefined();
  });
});
