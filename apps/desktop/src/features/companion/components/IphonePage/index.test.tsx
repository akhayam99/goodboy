// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const QR_SVG = '<svg data-testid="pairing-qr"></svg>';

type MockPhone = {
  id: string;
  name: string;
  pairedAt: string;
  lastSeen: string | null;
  liveSince: string | null;
  permissions: { canDecide: boolean; canMerge: boolean; canStart: boolean };
};

type BridgeMocks = {
  enrolledCount: number;
  pendingPairing: { id: string; name: string; code: string; askedAt: string } | null;
  rules: string[];
  fault: { code: string; message: string } | null;
  startError: string | null;
  phones: MockPhone[];
  interfaces: { name: string; addresses: string[]; isSelected: boolean }[];
  isReadFailing: boolean;
};

const mocks: BridgeMocks = vi.hoisted(() => ({
  enrolledCount: 0,
  pendingPairing: null,
  rules: [],
  fault: null,
  startError: null,
  isReadFailing: false,
  phones: [],
  interfaces: [],
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { resetStoryStore, storySpies } from '../../../../store/storyHarness';
import { IphonePage } from '.';

const invoke = storySpies.tauriInvoke;

const permissionsOf = (args: Record<string, unknown> | undefined): MockPhone['permissions'] => ({
  canDecide: Reflect.get(Object(args?.permissions), 'canDecide') === true,
  canMerge: Reflect.get(Object(args?.permissions), 'canMerge') === true,
  canStart: Reflect.get(Object(args?.permissions), 'canStart') === true,
});

const namesOf = (args: Record<string, unknown> | undefined): string[] =>
  Array.isArray(args?.names) ? args.names.filter((n): n is string => typeof n === 'string') : [];

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))
    : undefined;

const answer = async (command?: unknown, rawArgs?: unknown): Promise<unknown> => {
  const cmd = String(command);
  const args = recordOf(rawArgs);
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
  if ((cmd === 'bridge_status' || cmd === 'bridge_phones') && mocks.isReadFailing) {
    throw new Error('The bridge is busy');
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
    return mocks.rules;
  }
  if (cmd === 'permission_rule_delete') {
    return null;
  }
  if (cmd === 'bridge_phones') {
    return mocks.phones;
  }
  if (cmd === 'bridge_link_qr') {
    return '<svg data-testid="testflight-qr"></svg>';
  }
  if (cmd === 'bridge_interfaces') {
    return mocks.interfaces;
  }
  if (cmd === 'bridge_revoke_phone') {
    mocks.phones = mocks.phones.filter((p) => p.id !== args?.phoneId);
    mocks.enrolledCount = mocks.phones.length;
    return mocks.rules;
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

const invokedCommands = (): ReadonlyArray<string> => invoke.mock.calls.map(([cmd]) => String(cmd));

const meta = (): string | null =>
  document.querySelector('[data-slot="pane-meta"]')?.textContent ?? null;

beforeEach(async () => {
  await resetStoryStore();
  mocks.isReadFailing = false;
  mocks.enrolledCount = 0;
  mocks.pendingPairing = null;
  mocks.rules = [];
  mocks.fault = null;
  mocks.startError = null;
  mocks.phones = [];
  mocks.interfaces = [{ name: 'en0', addresses: ['192.168.1.20'], isSelected: true }];
  invoke.mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const harborline: MockPhone = {
  id: 'key-harborline',
  name: 'Harborline iPhone',
  pairedAt: '2026-11-20T10:00:00.000Z',
  lastSeen: '2026-11-27T09:12:00.000Z',
  liveSince: '2026-11-27T09:12:00.000Z',
  permissions: { canDecide: true, canMerge: true, canStart: false },
};
const northwind: MockPhone = {
  id: 'key-northwind',
  name: 'Northwind iPhone',
  pairedAt: '2026-11-21T10:00:00.000Z',
  lastSeen: '2026-11-25T09:00:00.000Z',
  liveSince: null,
  permissions: { canDecide: true, canMerge: false, canStart: true },
};

const renderPage = (onStopFailed = vi.fn()) =>
  render(<IphonePage animationClassName="" onStopFailed={onStopFailed} />);

const startPairing = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Pair an iPhone' }));
  return screen.findByTestId('pairing-qr');
};

const pair = (phones: MockPhone[]) => {
  mocks.phones = phones;
  mocks.enrolledCount = phones.length;
};

describe('IphonePage before a phone', () => {
  it('says what the iPhone does and offers Pair an iPhone as the one filled button', async () => {
    renderPage();

    expect(await screen.findByText('See what needs you')).toBeTruthy();
    screen.getByText('Decide from anywhere');
    screen.getByText('Stays between your devices');
    const pairButton = screen.getByRole('button', { name: 'Pair an iPhone' });
    expect(pairButton.getAttribute('data-variant')).toBe('primary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
    expect(meta()).toBeNull();
  });

  it('shows no code and starts no listener until Pair an iPhone is pressed', async () => {
    renderPage();
    await screen.findByText('See what needs you');

    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    expect(invokedCommands()).not.toContain('bridge_start');
    expect(screen.queryByRole('region', { name: 'Get Goodboy for iPhone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(invokedCommands()).not.toContain('bridge_link_qr');
  });

  it('shows the code with its countdown, then Cancel goes back', async () => {
    renderPage();
    await startPairing();

    expect(meta()).toBe('Pairing');
    screen.getByText('Expires in 60s');
    screen.getByText('Allow it here when it asks.');
    expect(screen.queryByRole('button', { name: 'Pair an iPhone' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    screen.getByText('See what needs you');
    await waitFor(() => expect(invokedCommands()).toContain('bridge_cancel_code'));
  });

  it('closes a code that was still being made when Cancel was pressed', async () => {
    let release: () => void = () => undefined;
    invoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'bridge_start') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return answer(cmd, args);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Pair an iPhone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    const cancelsBefore = invoke.mock.calls.filter(([cmd]) => cmd === 'bridge_cancel_code').length;
    release();

    await waitFor(() =>
      expect(invoke.mock.calls.filter(([cmd]) => cmd === 'bridge_cancel_code').length).toBe(
        cancelsBefore + 1,
      ),
    );
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
  });

  it('does not stop a listener this window never started when you leave the page', async () => {
    const view = renderPage();
    await screen.findByText('See what needs you');

    view.unmount();

    expect(invokedCommands()).not.toContain('bridge_stop');
  });

  it('puts the top bar switch under its own label, with no phone and with a phone', async () => {
    const view = renderPage();

    await screen.findByRole('region', { name: 'Top bar' });
    screen.getByRole('switch', { name: 'Show iPhone in the top bar' });
    view.unmount();
    pair([harborline]);
    renderPage();

    await screen.findByRole('region', { name: 'Top bar' });
    screen.getByRole('switch', { name: 'Show iPhone in the top bar' });
  });

  it('asks to allow a new iPhone with its code, and sends the answer for that request', async () => {
    mocks.pendingPairing = {
      id: 'a1b2',
      name: 'Harborline iPhone',
      code: '482 913',
      askedAt: '2026-11-27T10:00:00Z',
    };
    renderPage();

    expect(await screen.findByText('An iPhone wants to pair')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'Allow only if your iPhone shows 482 913.',
    );
    expect(screen.getByRole('button', { name: 'Allow' }).getAttribute('data-variant')).toBe(
      'primary',
    );
    expect(
      screen.getByRole('button', { name: 'Pair an iPhone' }).getAttribute('data-variant'),
    ).toBe('secondary');
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('bridge_pairing_decide', {
        id: 'a1b2',
        isAllowed: true,
      }),
    );
    await waitFor(() => expect(screen.queryByText('An iPhone wants to pair')).toBeNull());
  });

  it('sends a deny for the same request', async () => {
    mocks.pendingPairing = {
      id: 'c3d4',
      name: 'Northwind iPhone',
      code: '100 200',
      askedAt: 'now',
    };
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('bridge_pairing_decide', {
        id: 'c3d4',
        isAllowed: false,
      }),
    );
  });

  it('goes to the paired list once the iPhone has been allowed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await startPairing();

    pair([harborline]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(await screen.findByRole('group', { name: 'Harborline iPhone' })).toBeTruthy();
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    expect(meta()).toBe('1 paired');
  });

  it('says the pairing file is unusable and resets only on request', async () => {
    mocks.fault = { code: 'file_unreadable', message: 'The pairing file could not be read.' };
    renderPage();

    expect(await screen.findByText("Pairing isn't available")).toBeTruthy();
    screen.getByText('The pairing file could not be read.');
    expect(invokedCommands()).not.toContain('bridge_reset_pairing');

    fireEvent.click(screen.getByRole('button', { name: 'Reset pairing' }));

    await waitFor(() => expect(invokedCommands()).toContain('bridge_reset_pairing'));
    await waitFor(() => expect(screen.queryByText("Pairing isn't available")).toBeNull());
    screen.getByText('See what needs you');
  });

  it('says a code could not be made in one fixed sentence, never the exception, and retries', async () => {
    mocks.startError = 'Cannot read properties of undefined';
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Pair an iPhone' }));

    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't make a pairing code.");
    expect(screen.queryByText(/Cannot read properties/)).toBeNull();
    mocks.startError = null;
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));

    expect(await screen.findByTestId('pairing-qr')).toBeTruthy();
  });

  it('says in one sentence that no private network is on', async () => {
    invoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'bridge_start') {
        throw { kind: 'no_private_network', message: 'no private network is offered to phones' };
      }
      return answer(cmd, args);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Pair an iPhone' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No private network is on. Switch one on under Networks, or connect to Wi-Fi or a VPN.',
    );
  });

  it('stops the listener when you leave the page with no iPhone paired', async () => {
    const view = renderPage();
    await startPairing();

    view.unmount();

    expect(invokedCommands()).toContain('bridge_stop');
  });

  it('reports a listener that would not stop when you leave the page', async () => {
    invoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'bridge_stop') {
        throw new Error('The bridge is busy');
      }
      return answer(cmd, args);
    });
    const onStopFailed = vi.fn();
    const view = renderPage(onStopFailed);
    await startPairing();

    view.unmount();

    await waitFor(() =>
      expect(onStopFailed).toHaveBeenCalledWith({
        title: "Couldn't stop listening for iPhones",
        error: expect.any(Error),
      }),
    );
  });

  it('never calls the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();
    await startPairing();

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('IphonePage first read', () => {
  it('says the link could not be read when the first read fails and shows no page for it', async () => {
    mocks.isReadFailing = true;
    renderPage();

    expect(await screen.findByText("Couldn't read the iPhone link.")).toBeTruthy();
    expect(screen.queryByText('See what needs you')).toBeNull();
  });
});

describe('IphonePage with phones paired', () => {
  it('leads with the paired list and the header Pair an iPhone is quiet', async () => {
    pair([harborline]);
    renderPage();

    expect(await screen.findByRole('region', { name: 'Paired iPhones' })).toBeDefined();
    expect(meta()).toBe('1 paired');
    expect(screen.queryByText('See what needs you')).toBeNull();
    expect(screen.queryByTestId('pairing-qr')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Pair an iPhone' }).getAttribute('data-variant'),
    ).toBe('secondary');
    expect(invokedCommands()).not.toContain('bridge_start');
  });

  it('says for each iPhone whether it is live or offline, since when, and its last sync', async () => {
    pair([harborline, northwind]);
    renderPage();

    const first = await screen.findByRole('group', { name: 'Harborline iPhone' });
    const second = screen.getByRole('group', { name: 'Northwind iPhone' });

    expect(first.textContent).toMatch(/Live since .* Last sync just now\./);
    expect(second.textContent).toMatch(/Offline since .* Last sync .* ago\./);
    expect(first.querySelector('[data-status-tone="success"]')).not.toBeNull();
    expect(second.querySelector('[data-status-tone="warning"]')).not.toBeNull();
  });

  it('says a phone that never connected has not been seen', async () => {
    pair([{ ...northwind, lastSeen: null }]);
    renderPage();

    expect((await screen.findByRole('group', { name: 'Northwind iPhone' })).textContent).toContain(
      'Offline. Last sync never.',
    );
  });

  it('shows each iPhone its own rights as switches and changes one of them', async () => {
    pair([harborline, northwind]);
    renderPage();
    const first = await screen.findByRole('group', { name: 'Harborline iPhone' });
    const second = screen.getByRole('group', { name: 'Northwind iPhone' });

    expect(
      within(second)
        .getByRole('switch', { name: 'Merge pull requests for Northwind iPhone' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(
      within(first).getByRole('switch', { name: 'Start sessions for Harborline iPhone' }),
    );

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('bridge_set_permissions', {
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
  });

  it('removes one iPhone only after its own confirm and keeps the other', async () => {
    pair([harborline, northwind]);
    renderPage();
    await screen.findByRole('group', { name: 'Harborline iPhone' });

    const remove = screen.getByRole('button', { name: 'Remove Harborline iPhone' });
    expect(remove.getAttribute('data-intent')).toBe('destructive');
    fireEvent.click(remove);
    expect(invokedCommands()).not.toContain('bridge_revoke_phone');
    const dialog = screen.getByRole('dialog', { name: 'Remove Harborline iPhone?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('bridge_revoke_phone', {
        phoneId: 'key-harborline',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Harborline iPhone' })).toBeNull(),
    );
    screen.getByRole('group', { name: 'Northwind iPhone' });
    expect(invokedCommands()).not.toContain('bridge_revoke');
  });

  it('goes back to the start when the last iPhone is removed, with no code made', async () => {
    pair([harborline]);
    renderPage();
    await screen.findByRole('group', { name: 'Harborline iPhone' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Harborline iPhone' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Remove Harborline iPhone?' })).getByRole(
        'button',
        { name: 'Remove' },
      ),
    );

    expect(await screen.findByText('See what needs you')).toBeTruthy();
    expect(invokedCommands()).not.toContain('bridge_start');
  });

  it('cancelling the confirm keeps the iPhone paired', async () => {
    pair([harborline]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Harborline iPhone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(invokedCommands()).not.toContain('bridge_revoke_phone');
    screen.getByRole('group', { name: 'Harborline iPhone' });
  });

  it('removes every iPhone from one confirm and deletes the rules they made', async () => {
    pair([harborline, northwind]);
    mocks.rules = ['rule-1', 'rule-2'];
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove all iPhones' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove all paired iPhones?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove all iPhones' }));

    await waitFor(() =>
      expect(invoke.mock.calls.filter(([cmd]) => cmd === 'permission_rule_delete')).toHaveLength(2),
    );
    expect(invoke).toHaveBeenCalledWith('permission_rule_delete', { id: 'rule-1' });
    expect(await screen.findByText('See what needs you')).toBeTruthy();
  });

  it('shows the networks the Mac listens on with Bonjour and the port, and sends the chosen ones only', async () => {
    pair([harborline]);
    mocks.interfaces = [
      { name: 'en0', addresses: ['192.168.1.20'], isSelected: true },
      { name: 'utun4', addresses: ['100.101.102.103'], isSelected: true },
    ];
    renderPage();

    expect((await screen.findByText(/Bonjour is on\. Port 47821\./)).textContent).toContain(
      'listens only on the networks you switch on',
    );
    fireEvent.click(await screen.findByRole('switch', { name: 'Offer en0' }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('bridge_set_interfaces', { names: ['utun4'] }),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Offer en0' }).getAttribute('aria-checked')).toBe(
        'false',
      ),
    );
  });

  it('keeps the listener when you leave the page with an iPhone paired', async () => {
    pair([harborline]);
    const view = renderPage();
    await screen.findByRole('group', { name: 'Harborline iPhone' });

    view.unmount();

    expect(invokedCommands()).not.toContain('bridge_stop');
  });

  it('shows a pairing problem on top of the paired list with Reset pairing', async () => {
    pair([harborline]);
    mocks.fault = { code: 'key_mismatch', message: 'The pairing file and the Keychain differ.' };
    renderPage();

    expect(await screen.findByText("Pairing isn't available")).toBeTruthy();
    screen.getByRole('button', { name: 'Reset pairing' });
    screen.getByRole('group', { name: 'Harborline iPhone' });
  });

  it('turns the rows and the listener line to the problem while pairing is broken', async () => {
    pair([harborline, northwind]);
    mocks.fault = { code: 'key_mismatch', message: 'The pairing file and the Keychain differ.' };
    renderPage();

    const first = await screen.findByRole('group', { name: 'Harborline iPhone' });
    const second = screen.getByRole('group', { name: 'Northwind iPhone' });

    expect(first.textContent).toContain("Can't connect");
    expect(second.textContent).toContain("Can't connect");
    expect(first.querySelector('[data-status-tone="danger"]')).not.toBeNull();
    expect(second.querySelector('[data-status-tone="danger"]')).not.toBeNull();
    screen.getByText('Not listening until pairing is reset.');
    expect(screen.queryByText(/Bonjour is on/)).toBeNull();
  });

  it('keeps the paired list and says so when a read fails, never the before-a-phone page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pair([harborline]);
    renderPage();
    await screen.findByRole('group', { name: 'Harborline iPhone' });

    mocks.isReadFailing = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });

    expect(await screen.findByText(/Couldn't refresh the iPhone link/)).toBeTruthy();
    screen.getByRole('group', { name: 'Harborline iPhone' });
    expect(screen.queryByText('See what needs you')).toBeNull();
    expect(meta()).toBe('1 paired');

    mocks.isReadFailing = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() => expect(screen.queryByText(/Couldn't refresh the iPhone link/)).toBeNull());
  });
});
