// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { ProviderConnectState } from '../../../../store/slices/providers';

const { state } = vi.hoisted(() => ({
  state: {
    providerConnect: {} as Record<string, unknown>,
    providers: [
      { id: 'anthropic', label: 'claude code', connection: 'installed_disconnected' },
      { id: 'codex', label: 'codex', connection: 'installed_disconnected' },
    ] as ReadonlyArray<unknown>,
    connectProvider: vi.fn(async () => undefined),
    cancelProviderConnect: vi.fn(async () => undefined),
    dismissProviderConnect: vi.fn(() => undefined),
    refreshProviders: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../ProviderLifecycleTile/InlineTerminal', () => ({
  InlineTerminal: () => <div>live terminal</div>,
}));

import { ProviderConnectModal } from './index';

const IDLE: ProviderConnectState = {
  phase: 'idle',
  step: null,
  runId: null,
  command: null,
  authUrl: null,
  identity: null,
  errorTail: null,
  startedAt: null,
};

const setConnect = (providerId: string, patch: Partial<ProviderConnectState>) => {
  state.providerConnect = {
    ...state.providerConnect,
    [providerId]: { ...IDLE, ...patch },
  };
};

beforeEach(() => {
  state.connectProvider = vi.fn(async () => undefined);
  state.cancelProviderConnect = vi.fn(async () => undefined);
  state.providerConnect = { anthropic: { ...IDLE }, codex: { ...IDLE } };
});

afterEach(cleanup);

describe('ProviderConnectModal', () => {
  it('starts the connect for the provider it opens on, and for the next one after a close', async () => {
    const view = render(
      <ProviderConnectModal providerId={'anthropic' as ProviderId} onClose={vi.fn()} />,
    );

    expect(state.connectProvider).toHaveBeenCalledWith('anthropic');

    await act(async () => {
      view.rerender(<ProviderConnectModal providerId={null} onClose={vi.fn()} />);
    });
    await act(async () => {
      view.rerender(<ProviderConnectModal providerId={'codex' as ProviderId} onClose={vi.fn()} />);
    });

    expect(state.connectProvider).toHaveBeenCalledWith('codex');
  });

  it('leaves the attempt running when the dialog closes, and shows its phase on reopen', async () => {
    setConnect('anthropic', { phase: 'working', step: 'login' });
    const view = render(
      <ProviderConnectModal providerId={'anthropic' as ProviderId} onClose={vi.fn()} />,
    );

    await act(async () => {
      view.rerender(<ProviderConnectModal providerId={null} onClose={vi.fn()} />);
    });

    expect(state.cancelProviderConnect).not.toHaveBeenCalled();

    setConnect('anthropic', { phase: 'handoff', step: 'login', authUrl: 'https://claude.ai/cli' });
    await act(async () => {
      view.rerender(
        <ProviderConnectModal providerId={'anthropic' as ProviderId} onClose={vi.fn()} />,
      );
    });

    expect(screen.getByText('Finish signing in in your browser.')).toBeDefined();
    expect(state.cancelProviderConnect).not.toHaveBeenCalled();
    expect(state.connectProvider).not.toHaveBeenCalled();
  });

  it('does not cancel the attempt when the surface unmounts', async () => {
    setConnect('anthropic', { phase: 'handoff', step: 'login' });
    const view = render(
      <ProviderConnectModal providerId={'anthropic' as ProviderId} onClose={vi.fn()} />,
    );

    await act(async () => {
      view.unmount();
    });

    expect(state.cancelProviderConnect).not.toHaveBeenCalled();
  });
});
