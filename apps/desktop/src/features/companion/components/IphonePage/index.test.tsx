// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const QR_SVG = '<svg data-testid="pairing-qr"></svg>';

type BridgeMocks = {
  enrolledCount: number;
  startError: string | null;
  readonly invoke: ReturnType<
    typeof vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>
  >;
};

const mocks: BridgeMocks = vi.hoisted(() => ({
  enrolledCount: 0,
  startError: null,
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

import { IphonePage } from '.';

const answer = async (cmd: string): Promise<unknown> => {
  if (cmd === 'bridge_start') {
    if (mocks.startError !== null) {
      throw new Error(mocks.startError);
    }
    return {
      payload: '{}',
      svg: QR_SVG,
      deviceName: 'Harborline MacBook',
      port: 47821,
      expiresInSecs: 60,
    };
  }
  if (cmd === 'bridge_status') {
    return { running: true, port: 47821, enrolledCount: mocks.enrolledCount };
  }
  if (cmd === 'bridge_revoke') {
    mocks.enrolledCount = 0;
    return null;
  }
  return null;
};

const invokedCommands = (): ReadonlyArray<string> => mocks.invoke.mock.calls.map(([cmd]) => cmd);

const meta = (): string | null =>
  document.querySelector('[data-slot="pane-meta"]')?.textContent ?? null;

beforeEach(() => {
  mocks.enrolledCount = 0;
  mocks.startError = null;
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IphonePage', () => {
  it('shows the code at once when no iPhone is paired, with the testing note under it', async () => {
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'iPhone' })).toBeDefined();
    expect(meta()).toBe('Pairing');
    expect(screen.queryByRole('button', { name: 'Pair an iPhone' })).toBeNull();
    const pairing = screen.getByRole('region', { name: 'Pair an iPhone' });
    const note = screen.getByText('Goodboy for iPhone is in private testing');
    expect(pairing.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leads with the paired list, swaps in the code from the header and Cancel goes back', async () => {
    mocks.enrolledCount = 1;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByText('1 paired iPhone')).toBeTruthy();
    expect(meta()).toBe('1 paired');
    expect(screen.getByRole('region', { name: 'Paired iPhones' })).toBeDefined();
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    expect(screen.queryByRole('button', { name: /Pair another device/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pair an iPhone' }));

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
    expect(meta()).toBe('Pairing');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    screen.getByText('1 paired iPhone');
  });

  it('goes back to the list once the iPhone has scanned the code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.enrolledCount = 1;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pair an iPhone' }));
    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();

    mocks.enrolledCount = 2;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(await screen.findByText('2 paired iPhones')).toBeTruthy();
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
  });

  it('disconnects only after the popover confirm, then shows a fresh code', async () => {
    mocks.enrolledCount = 2;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/ }));
    expect(invokedCommands()).not.toContain('bridge_revoke');
    const dialog = screen.getByRole('dialog', { name: 'Disconnect all paired devices?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(invokedCommands()).toContain('bridge_revoke'));
    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('cancelling the confirm keeps every iPhone paired', async () => {
    mocks.enrolledCount = 1;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(invokedCommands()).not.toContain('bridge_revoke');
    screen.getByText('1 paired iPhone');
  });

  it('stops the listener when you leave the page with no iPhone paired', async () => {
    const view = render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    await screen.findByTestId('pairing-qr');

    view.unmount();

    expect(invokedCommands()).toContain('bridge_stop');
  });

  it('reports a listener that would not stop when you leave the page', async () => {
    mocks.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'bridge_stop') {
        throw new Error('The bridge is busy');
      }
      return answer(cmd);
    });
    const onStopFailed = vi.fn();
    const view = render(<IphonePage animationClassName="" onStopFailed={onStopFailed} />);
    await screen.findByTestId('pairing-qr');

    view.unmount();

    await waitFor(() =>
      expect(onStopFailed).toHaveBeenCalledWith({
        title: "Couldn't stop listening for iPhones",
        error: expect.any(Error),
      }),
    );
  });

  it('keeps the listener when you leave the page with an iPhone paired', async () => {
    mocks.enrolledCount = 1;
    const view = render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    await screen.findByText('1 paired iPhone');

    view.unmount();

    expect(invokedCommands()).not.toContain('bridge_stop');
  });

  it('says on the page why a code could not be made, and retries', async () => {
    mocks.startError = 'The port is taken';
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByText(/The port is taken/)).toBeTruthy();
    mocks.startError = null;
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });
});
