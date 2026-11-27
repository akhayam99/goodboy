// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const QR_SVG = '<svg data-testid="pairing-qr"></svg>';

type MockPhone = {
  id: string;
  name: string;
  pairedAt: string;
  lastSeen: string | null;
  permissions: { canDecide: boolean; canMerge: boolean; canStart: boolean };
};

type BridgeMocks = {
  enrolledCount: number;
  pendingPairing: { id: string; name: string; askedAt: string } | null;
  fault: { code: string; message: string } | null;
  startError: string | null;
  phones: MockPhone[];
  interfaces: { name: string; addresses: string[]; isSelected: boolean }[];
  readonly invoke: ReturnType<
    typeof vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>
  >;
};

const mocks: BridgeMocks = vi.hoisted(() => ({
  enrolledCount: 0,
  pendingPairing: null,
  fault: null,
  startError: null,
  phones: [],
  interfaces: [],
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

import { IphonePage } from '.';

const permissionsOf = (args: Record<string, unknown> | undefined): MockPhone['permissions'] => ({
  canDecide: Reflect.get(Object(args?.permissions), 'canDecide') === true,
  canMerge: Reflect.get(Object(args?.permissions), 'canMerge') === true,
  canStart: Reflect.get(Object(args?.permissions), 'canStart') === true,
});

const namesOf = (args: Record<string, unknown> | undefined): string[] =>
  Array.isArray(args?.names) ? args.names.filter((n): n is string => typeof n === 'string') : [];

const answer = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (cmd === 'bridge_start') {
    if (mocks.startError !== null || mocks.fault !== null) {
      throw new Error(mocks.startError ?? 'identity_unavailable');
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
    return {
      running: true,
      port: 47821,
      enrolledCount: mocks.enrolledCount,
      isAdvertised: true,
      pendingPairing: mocks.pendingPairing,
      fault: mocks.fault,
    };
  }
  if (cmd === 'bridge_pairing_decide') {
    mocks.pendingPairing = null;
    return true;
  }
  if (cmd === 'bridge_reset_pairing') {
    mocks.fault = null;
    return null;
  }
  if (cmd === 'bridge_revoke') {
    mocks.enrolledCount = 0;
    mocks.phones = [];
    return null;
  }
  if (cmd === 'bridge_phones') {
    return mocks.phones;
  }
  if (cmd === 'bridge_interfaces') {
    return mocks.interfaces;
  }
  if (cmd === 'bridge_revoke_phone') {
    mocks.phones = mocks.phones.filter((p) => p.id !== args?.phoneId);
    mocks.enrolledCount = mocks.phones.length;
    return null;
  }
  if (cmd === 'bridge_set_permissions') {
    mocks.phones = mocks.phones.map((p) =>
      p.id === args?.phoneId ? { ...p, permissions: permissionsOf(args) } : p,
    );
    return null;
  }
  if (cmd === 'bridge_set_interfaces') {
    const names = namesOf(args);
    mocks.interfaces = mocks.interfaces.map((n) => ({ ...n, isSelected: names.includes(n.name) }));
    return null;
  }
  return null;
};

const invokedCommands = (): ReadonlyArray<string> => mocks.invoke.mock.calls.map(([cmd]) => cmd);

const meta = (): string | null =>
  document.querySelector('[data-slot="pane-meta"]')?.textContent ?? null;

beforeEach(() => {
  mocks.enrolledCount = 0;
  mocks.pendingPairing = null;
  mocks.fault = null;
  mocks.startError = null;
  mocks.phones = [];
  mocks.interfaces = [{ name: 'en0', addresses: ['192.168.1.20'], isSelected: true }];
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IphonePage', () => {
  it('asks the user to allow a new iPhone and sends the answer for that request', async () => {
    mocks.pendingPairing = {
      id: 'a1b2',
      name: 'Harborline iPhone',
      askedAt: '2026-11-27T10:00:00Z',
    };
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByText('An iPhone wants to pair')).toBeTruthy();
    screen.getByText(/Harborline iPhone scanned your code/);
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('bridge_pairing_decide', {
        id: 'a1b2',
        isAllowed: true,
      }),
    );
    await waitFor(() => expect(screen.queryByText('An iPhone wants to pair')).toBeNull());
  });

  it('sends a deny for the same request', async () => {
    mocks.pendingPairing = { id: 'c3d4', name: 'Northwind iPhone', askedAt: 'now' };
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('bridge_pairing_decide', {
        id: 'c3d4',
        isAllowed: false,
      }),
    );
  });

  it('says the pairing file is unusable instead of showing a code, and resets only on request', async () => {
    mocks.fault = { code: 'file_unreadable', message: 'The pairing file could not be read.' };
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByText('Pairing is not available')).toBeTruthy();
    screen.getByText('The pairing file could not be read.');
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    expect(invokedCommands()).not.toContain('bridge_reset_pairing');

    fireEvent.click(screen.getByRole('button', { name: 'Reset pairing' }));

    await waitFor(() => expect(invokedCommands()).toContain('bridge_reset_pairing'));
    await waitFor(() => expect(screen.queryByText('Pairing is not available')).toBeNull());
    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

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

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect all' }));
    expect(invokedCommands()).not.toContain('bridge_revoke');
    const dialog = screen.getByRole('dialog', { name: 'Disconnect all paired devices?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(invokedCommands()).toContain('bridge_revoke'));
    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('cancelling the confirm keeps every iPhone paired', async () => {
    mocks.enrolledCount = 1;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect all' }));
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
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'bridge_stop') {
        throw new Error('The bridge is busy');
      }
      return answer(cmd, args);
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

  it('says a code could not be made in one fixed sentence, never the exception, and retries', async () => {
    mocks.startError = 'Cannot read properties of undefined';
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't make a pairing code.");
    expect(screen.queryByText(/Cannot read properties/)).toBeNull();
    mocks.startError = null;
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('keeps the paired iPhones and their rights in reach when no code can be made', async () => {
    mocks.phones = [harborline];
    mocks.enrolledCount = 1;
    mocks.startError = 'no private network';
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect(await screen.findByRole('group', { name: 'Harborline iPhone' })).toBeTruthy();
    expect(await screen.findByText("Couldn't make a pairing code.")).toBeTruthy();
    screen.getByRole('switch', { name: 'Start sessions for Harborline iPhone' });
  });

  const harborline: MockPhone = {
    id: 'key-harborline',
    name: 'Harborline iPhone',
    pairedAt: '2026-11-20T10:00:00.000Z',
    lastSeen: null,
    permissions: { canDecide: true, canMerge: true, canStart: false },
  };
  const northwind: MockPhone = {
    id: 'key-northwind',
    name: 'Northwind iPhone',
    pairedAt: '2026-11-21T10:00:00.000Z',
    lastSeen: '2026-11-25T09:00:00.000Z',
    permissions: { canDecide: true, canMerge: false, canStart: true },
  };

  it('lists each paired iPhone with its own rights and last seen', async () => {
    mocks.phones = [harborline, northwind];
    mocks.enrolledCount = 2;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    const first = await screen.findByRole('group', { name: 'Harborline iPhone' });
    const second = screen.getByRole('group', { name: 'Northwind iPhone' });

    expect(within(first).getByText(/Not seen yet/).textContent).toContain('Not seen yet');
    expect(
      within(first)
        .getByRole('switch', { name: 'Start sessions for Harborline iPhone' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      within(second)
        .getByRole('switch', { name: 'Start sessions for Northwind iPhone' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(second)
        .getByRole('switch', { name: 'Merge pull requests for Northwind iPhone' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('changes one iPhone rights and reads them back from the Mac', async () => {
    mocks.phones = [harborline, northwind];
    mocks.enrolledCount = 2;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    const first = await screen.findByRole('group', { name: 'Harborline iPhone' });

    fireEvent.click(
      within(first).getByRole('switch', { name: 'Start sessions for Harborline iPhone' }),
    );

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('bridge_set_permissions', {
        phoneId: 'key-harborline',
        permissions: { canDecide: true, canMerge: true, canStart: true },
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('group', { name: 'Harborline iPhone' }))
          .getByRole('switch', { name: 'Start sessions for Harborline iPhone' })
          .getAttribute('aria-checked'),
      ).toBe('true'),
    );
    expect(
      within(screen.getByRole('group', { name: 'Northwind iPhone' }))
        .getByRole('switch', { name: 'Start sessions for Northwind iPhone' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('disconnects one iPhone after its own confirm and keeps the other', async () => {
    mocks.phones = [harborline, northwind];
    mocks.enrolledCount = 2;
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    await screen.findByRole('group', { name: 'Harborline iPhone' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Harborline iPhone' }));
    expect(invokedCommands()).not.toContain('bridge_revoke_phone');
    const dialog = screen.getByRole('dialog', { name: 'Disconnect Harborline iPhone?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('bridge_revoke_phone', {
        phoneId: 'key-harborline',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Harborline iPhone' })).toBeNull(),
    );
    expect(screen.getByRole('group', { name: 'Northwind iPhone' }).textContent).toContain(
      'Northwind iPhone',
    );
    expect(invokedCommands()).not.toContain('bridge_revoke');
  });

  it('shows the networks the code offers and sends the chosen ones only', async () => {
    mocks.interfaces = [
      { name: 'en0', addresses: ['192.168.1.20'], isSelected: true },
      { name: 'utun4', addresses: ['100.101.102.103'], isSelected: true },
    ];
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);
    await screen.findByTestId('pairing-qr');

    fireEvent.click(await screen.findByRole('switch', { name: 'Offer en0' }));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('bridge_set_interfaces', { names: ['utun4'] }),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Offer en0' }).getAttribute('aria-checked')).toBe(
        'false',
      ),
    );
  });

  it('says in one sentence that no private network is on', async () => {
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'bridge_start') {
        throw { kind: 'no_private_network', message: 'no private network is offered to phones' };
      }
      return answer(cmd, args);
    });
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No private network is on. Switch one on under Networks, or connect to Wi-Fi or a VPN.',
    );
  });

  it('tells the new iPhone what it may do before it pairs', async () => {
    render(<IphonePage animationClassName="" onStopFailed={vi.fn()} />);

    expect((await screen.findByText(/Starting sessions stays off/)).textContent).toContain(
      'Change it per iPhone',
    );
  });
});
