// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { ProviderConnectState } from '../../../../store/slices/providers';

const { state, openUrl } = vi.hoisted(() => ({
  state: {
    providerConnect: {} as Record<string, unknown>,
    providers: [] as ReadonlyArray<unknown>,
    connectProvider: vi.fn(async () => undefined),
    cancelProviderConnect: vi.fn(async () => undefined),
    dismissProviderConnect: vi.fn(() => undefined),
    refreshProviders: vi.fn(async () => undefined),
  },
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('../../../../shared/lib/editor', () => ({ openUrl }));

vi.mock('../ProviderLifecycleTile/InlineTerminal', () => ({
  InlineTerminal: () => <div>live terminal</div>,
}));

import { ProviderConnect } from './index';

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

const setConnect = (patch: Partial<ProviderConnectState>) => {
  state.providerConnect = { anthropic: { ...IDLE, ...patch }, gemini: { ...IDLE } };
};

const renderConnect = (chrome: 'studio' | 'modal' | 'inline' = 'modal', id = 'anthropic') =>
  render(<ProviderConnect providerId={id as ProviderId} chrome={chrome} onDone={vi.fn()} />);

beforeEach(() => {
  state.connectProvider = vi.fn(async () => undefined);
  state.cancelProviderConnect = vi.fn(async () => undefined);
  state.dismissProviderConnect = vi.fn(() => undefined);
  setConnect({});
});

afterEach(cleanup);

describe('ProviderConnect', () => {
  it('offers one action at rest, with no terminal and no details', () => {
    renderConnect();

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(state.connectProvider).toHaveBeenCalledWith('anthropic');
    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
    expect(screen.queryByText('live terminal')).toBeNull();
    expect(screen.getByText(/credentials never pass through it/i)).toBeDefined();
  });

  it('names the install step and swaps the action for cancel', () => {
    setConnect({ phase: 'working', step: 'install', command: 'npm i -g claude' });
    renderConnect();

    expect(screen.getByText('Installing the claude tool…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.cancelProviderConnect).toHaveBeenCalledWith('anthropic');
  });

  it('hands off to the browser and can reopen the link', () => {
    setConnect({ phase: 'handoff', step: 'login', authUrl: 'https://claude.ai/cli' });
    renderConnect();

    expect(screen.getByText('Finish signing in from your browser.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open the link again' }));
    expect(openUrl).toHaveBeenCalledWith('https://claude.ai/cli');
  });

  it('offers the terminal fallback only once the wait is long enough', () => {
    setConnect({ phase: 'waiting-long', step: 'login', command: 'claude auth login' });
    const view = renderConnect();

    expect(
      screen.getByText('Still waiting for the browser. This can take a minute.'),
    ).toBeDefined();
    expect(screen.queryByText(/If this keeps failing/)).toBeNull();

    setConnect({ phase: 'fallback-offered', step: 'login', command: 'claude auth login' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText(/If this keeps failing/)).toBeDefined();
    expect(screen.getByText('claude auth login')).toBeDefined();
  });

  it('auto expands the details on a stall and keeps them closed while it runs', () => {
    setConnect({ phase: 'working', step: 'login', runId: 'run-1' });
    const view = renderConnect();

    expect(screen.queryByText('live terminal')).toBeNull();

    setConnect({ phase: 'stall', step: 'login', runId: 'run-1' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText('This sign-in needs a choice from you.')).toBeDefined();
    expect(screen.getByText('live terminal')).toBeDefined();
  });

  it('keeps the forced-open details mounted when output flips the phase back to working', () => {
    setConnect({ phase: 'stall', step: 'login', runId: 'run-1' });
    const view = renderConnect();

    expect(screen.getByText('live terminal')).toBeDefined();

    setConnect({ phase: 'working', step: 'login', runId: 'run-1' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText('live terminal')).toBeDefined();
  });

  it('reopens the details for a later phase that needs them after the user closed them', () => {
    setConnect({ phase: 'stall', step: 'login', runId: 'run-1' });
    const view = renderConnect();

    fireEvent.click(screen.getByRole('button', { name: /Hide details/ }));
    expect(screen.queryByText('live terminal')).toBeNull();

    setConnect({ phase: 'failed', step: 'login', runId: 'run-1', command: 'claude auth login' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText('live terminal')).toBeDefined();
  });

  it('keeps the details mounted when the run succeeds while focus sits inside them', () => {
    setConnect({ phase: 'stall', step: 'login', runId: 'run-1' });
    const view = renderConnect();

    fireEvent.focusIn(screen.getByText('live terminal'));

    setConnect({ phase: 'success', identity: 'ada@example.com', runId: 'run-1' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText('live terminal')).toBeDefined();
  });

  it('lets the user close details the phase forced open', () => {
    setConnect({ phase: 'stall', step: 'login', runId: 'run-1' });
    renderConnect();

    fireEvent.click(screen.getByRole('button', { name: /Hide details/ }));

    expect(screen.queryByText('live terminal')).toBeNull();
    expect(screen.getByRole('button', { name: /Show details/ })).toBeDefined();
  });

  it('keeps hand-opened details open across a phase change', () => {
    setConnect({ phase: 'working', step: 'login', runId: 'run-1' });
    const view = renderConnect();

    fireEvent.click(screen.getByRole('button', { name: /Show details/ }));
    expect(screen.getByText('live terminal')).toBeDefined();

    setConnect({ phase: 'handoff', step: 'login', runId: 'run-1', authUrl: 'https://x.test' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(screen.getByText('live terminal')).toBeDefined();
  });

  it('reports a failure with its output and retries in place', () => {
    setConnect({
      phase: 'failed',
      step: 'login',
      command: 'claude auth login',
      errorTail: 'error: could not reach the auth server',
      runId: 'run-1',
    });
    renderConnect();

    expect(screen.getByText("Sign-in didn't finish.")).toBeDefined();
    expect(screen.getByText('error: could not reach the auth server')).toBeDefined();
    expect(screen.getByText('live terminal')).toBeDefined();
    expect(screen.getByText(/If this keeps failing/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.connectProvider).toHaveBeenCalledWith('anthropic');
  });

  it('says so when the run failed without printing anything', () => {
    setConnect({ phase: 'failed', step: 'login', command: 'claude auth login', errorTail: null });
    renderConnect();

    expect(screen.getByText(/without printing anything/i)).toBeDefined();
  });

  it('names the other window instead of blaming the sign-in when the provider is busy', () => {
    setConnect({ phase: 'blocked', step: 'login', command: 'claude auth login' });
    renderConnect();

    expect(screen.getByText(/Another window is already signing in to claude/)).toBeDefined();
    expect(screen.queryByText("Sign-in didn't finish.")).toBeNull();
    expect(screen.queryByText(/If this keeps failing/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('prints the command to read inside the details, never at rest', () => {
    setConnect({ phase: 'failed', step: 'login', command: 'claude auth login', runId: 'run-1' });
    renderConnect();

    expect(screen.getAllByText('claude auth login').length).toBeGreaterThan(1);
  });

  it('confirms the identity on success and never claims one when unverified', () => {
    setConnect({ phase: 'success', identity: 'ada@example.com' });
    const view = renderConnect();

    expect(screen.getByText('Connected as ada@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();

    setConnect({ phase: 'finished-unverified' });
    view.rerender(
      <ProviderConnect providerId={'anthropic' as ProviderId} chrome="modal" onDone={vi.fn()} />,
    );

    expect(
      screen.getByText('Sign-in finished. Run a small task to confirm it worked.'),
    ).toBeDefined();
    expect(screen.queryByText(/^Connected/)).toBeNull();
  });

  it('drops the primary action in the studio once the account is connected', () => {
    setConnect({ phase: 'success', identity: 'ada@example.com' });
    renderConnect('studio');

    expect(screen.getByText('Connected as ada@example.com')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('never offers connect for a provider Goodboy cannot drive', () => {
    renderConnect('modal', 'gemini');

    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.getByText(/no auth subcommand/i)).toBeDefined();
  });
});
