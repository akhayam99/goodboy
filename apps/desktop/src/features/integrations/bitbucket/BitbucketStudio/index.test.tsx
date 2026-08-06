// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';
import type { BitbucketRepo } from '../client';
import type { BitbucketPrGroup } from './useBitbucketPrs';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  repo: null as BitbucketRepo | null,
  groups: [] as ReadonlyArray<BitbucketPrGroup>,
  disconnectBitbucket: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      sessions: ReadonlyArray<{ id: string; workspaceId: string }>;
      sessionBitbucketRepo: Record<string, BitbucketRepo | undefined>;
      sessionBitbucketPr: Record<string, { pr: null; loading: boolean; error: null } | undefined>;
      refreshSessionBitbucketPr: () => Promise<void>;
      selectSessionBitbucketPr: () => Promise<void>;
      workspaceIntegrations: typeof h.integrations;
      disconnectBitbucket: typeof h.disconnectBitbucket;
    }) => T,
  ) =>
    selector({
      sessions: [{ id: 'session-1', workspaceId: 'workspace-1' }],
      sessionBitbucketRepo: { 'session-1': h.repo ?? undefined },
      sessionBitbucketPr: {},
      refreshSessionBitbucketPr: vi.fn(async () => undefined),
      selectSessionBitbucketPr: vi.fn(async () => undefined),
      workspaceIntegrations: h.integrations,
      disconnectBitbucket: h.disconnectBitbucket,
    }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory?: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('./useBitbucketPrs', () => ({
  useBitbucketPrs: () => ({
    groups: h.groups,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('./PrInbox', () => ({ PrInbox: () => <div>Pull request inbox</div> }));
vi.mock('./PrDetailPanel', () => ({ PrDetailPanel: () => <div>Pull request detail</div> }));
vi.mock('../BitbucketFormBody', () => ({
  BitbucketFormBody: () => (
    <label htmlFor="bitbucket-token-test">
      App password
      <input id="bitbucket-token-test" />
    </label>
  ),
}));

import { BitbucketStudio } from '.';

const renderStudio = () =>
  render(
    <ToastProvider>
      <BitbucketStudio
        sessionId={'session-1' as SessionId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  h.integrations = {};
  h.repo = null;
  h.groups = [];
});
afterEach(() => {
  cleanup();
  h.disconnectBitbucket.mockReset();
});

describe('BitbucketStudio', () => {
  it('asks for the connection before a repository resolves', () => {
    renderStudio();

    expect(
      screen.getByText('Connect Bitbucket to review pull requests from this workspace'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Disconnect Bitbucket' })).toBeNull();
  });

  it('shows the inbox and a disconnect control once a repo resolves', () => {
    h.integrations = { 'workspace-1': [{ provider: 'bitbucket' }] };
    h.repo = {
      workspaceId: 'workspace-1' as WorkspaceId,
      workspaceSlug: 'acme',
      repoSlug: 'goodboy',
      email: 'dev@acme.test',
    };

    renderStudio();

    expect(screen.getByText('Pull request inbox')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Disconnect Bitbucket' })).toBeDefined();
  });

  it('disconnects Bitbucket from the header', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'bitbucket' }] };
    h.repo = {
      workspaceId: 'workspace-1' as WorkspaceId,
      workspaceSlug: 'acme',
      repoSlug: 'goodboy',
      email: 'dev@acme.test',
    };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Bitbucket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Bitbucket' }));

    await vi.waitFor(() =>
      expect(h.disconnectBitbucket).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }),
    );
  });
});
