// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    providerLifecycle: {
      anthropic: { phase: 'idle', action: null, runId: null, command: null, errorTail: null },
      codex: { phase: 'idle', action: null, runId: null, command: null, errorTail: null },
    } as Record<string, unknown>,
    providers: [
      {
        id: 'anthropic',
        label: 'claude code',
        connection: 'installed_disconnected',
        identity: null,
      },
      { id: 'codex', label: 'codex', connection: 'installed_disconnected', identity: null },
    ] as ReadonlyArray<{
      readonly id: string;
      readonly label: string;
      readonly connection: string;
      readonly identity: string | null;
    }>,
    installProvider: vi.fn(async () => undefined),
    loginProvider: vi.fn(async () => undefined),
    cancelProviderLifecycle: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('../ProviderLifecycleTile/InlineTerminal', () => ({
  InlineTerminal: () => <div>terminal</div>,
}));

import { ProviderConnectModal } from './index';

beforeEach(() => {
  state.installProvider = vi.fn(async () => undefined);
  state.loginProvider = vi.fn(async () => undefined);
  state.providers = [
    { id: 'anthropic', label: 'claude code', connection: 'installed_disconnected', identity: null },
    { id: 'codex', label: 'codex', connection: 'installed_disconnected', identity: null },
  ];
});

afterEach(cleanup);

describe('ProviderConnectModal', () => {
  it('auto starts the sign-in again for the next provider after a close', async () => {
    const view = render(
      <ProviderConnectModal
        providerId={'anthropic' as ProviderId}
        initialAction="login"
        onClose={vi.fn()}
      />,
    );

    expect(state.loginProvider).toHaveBeenCalledWith('anthropic');

    await act(async () => {
      view.rerender(
        <ProviderConnectModal providerId={null} initialAction="login" onClose={vi.fn()} />,
      );
    });
    await act(async () => {
      view.rerender(
        <ProviderConnectModal
          providerId={'codex' as ProviderId}
          initialAction="login"
          onClose={vi.fn()}
        />,
      );
    });

    expect(state.loginProvider).toHaveBeenCalledWith('codex');
  });

  it('names the dialog and keeps a close control while a run is in flight', () => {
    state.providerLifecycle = {
      ...state.providerLifecycle,
      anthropic: {
        phase: 'connecting',
        action: 'login',
        runId: null,
        command: null,
        errorTail: null,
      },
    };

    render(
      <ProviderConnectModal
        providerId={'anthropic' as ProviderId}
        initialAction="login"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /claude code/i })).toBeDefined();
    expect(
      screen.getByText('Step through install and sign-in without leaving Goodboy.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'close' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Back to account' })).toBeNull();
  });

  it('confirms the connected identity', () => {
    state.providers = [
      {
        id: 'anthropic',
        label: 'claude code',
        connection: 'connected',
        identity: 'ada@example.com',
      },
    ];

    render(
      <ProviderConnectModal
        providerId={'anthropic' as ProviderId}
        initialAction="login"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Connected as ada@example.com')).toBeDefined();
  });
});
