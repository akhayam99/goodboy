// @vitest-environment happy-dom

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
vi.mock('../../../../shared/lib/dispatchWindowEvent', () => ({
  dispatchWindowEvent: ({ name }: { name: string }) => {
    events.names.push(name);
  },
}));

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStoryStore, storySpies } from '../../../../store/storyHarness';
import { useIphoneBarIconStore } from '../../iphoneBarIconStore';
import { IphoneEntry } from '.';

type Phone = {
  id: string;
  name: string;
  pairedAt: string;
  lastSeen: string | null;
  liveSince: string | null;
  permissions: { canDecide: boolean; canMerge: boolean; canStart: boolean };
};

type Bridge = {
  phones: Phone[];
  priorPhones: number | null;
  fault: { code: string; message: string } | null;
  isReadFailing: boolean;
};

const events = vi.hoisted(() => ({ names: new Array<string>() }));

const bridge: Bridge = { phones: [], priorPhones: null, fault: null, isReadFailing: false };

const invoke = storySpies.tauriInvoke;

const harborline: Phone = {
  id: 'key-harborline',
  name: 'Harborline iPhone',
  pairedAt: '2026-11-20T10:00:00.000Z',
  lastSeen: new Date().toISOString(),
  liveSince: new Date().toISOString(),
  permissions: { canDecide: true, canMerge: true, canStart: false },
};

const northwind: Phone = {
  ...harborline,
  id: 'key-northwind',
  name: 'Northwind iPhone',
  lastSeen: new Date(Date.now() - 14 * 60_000).toISOString(),
  liveSince: null,
  permissions: { canDecide: true, canMerge: false, canStart: false },
};

const answer = async (command?: unknown): Promise<unknown> => {
  const cmd = String(command);
  if (
    (cmd === 'bridge_status' || cmd === 'bridge_phones' || cmd === 'bridge_link_hint') &&
    bridge.isReadFailing
  ) {
    throw new Error('The bridge is busy');
  }
  if (cmd === 'bridge_status') {
    return {
      running: true,
      port: 47821,
      enrolledCount: bridge.phones.length,
      isAdvertised: true,
      pendingPairing: null,
      fault: bridge.fault,
      priorPhoneCount: bridge.priorPhones ?? bridge.phones.length,
    };
  }
  if (cmd === 'bridge_link_hint') {
    return { priorPhoneCount: bridge.priorPhones ?? bridge.phones.length, fault: bridge.fault };
  }
  if (cmd === 'bridge_phones') {
    return bridge.phones;
  }
  return null;
};

const entry = async (state: string) => {
  await waitFor(() =>
    expect(document.querySelector(`[data-iphone-entry="${state}"]`)).not.toBeNull(),
  );
  const found = document.querySelector<HTMLElement>(`[data-iphone-entry="${state}"]`);
  if (found === null) {
    throw new Error('the iPhone entry is not in the bar');
  }
  return found;
};

const commands = (): ReadonlyArray<string> => invoke.mock.calls.map(([cmd]) => String(cmd));

beforeEach(async () => {
  await resetStoryStore();
  bridge.phones = [];
  bridge.priorPhones = null;
  bridge.fault = null;
  bridge.isReadFailing = false;
  events.names = [];
  invoke.mockImplementation(answer);
  useIphoneBarIconStore.setState({ isShown: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IphoneEntry', () => {
  it('has no dot when no phone is paired and a click goes straight to the iPhone page', async () => {
    render(<IphoneEntry />);
    const button = await entry('none');

    expect(button.querySelector('[data-status-mark]')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe('iPhone, Not paired');
    fireEvent.click(button);

    expect(events.names).toEqual(['goodboy:open-pair-device']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads only the phone list once, and never the status, for someone who never paired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<IphoneEntry />);
    await entry('none');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(new Set(commands())).toEqual(new Set(['bridge_phones', 'bridge_link_hint']));
  });

  it('shows no dot and no alarm for someone who never paired when the Keychain is unavailable', async () => {
    bridge.fault = { code: 'keychain_unavailable', message: 'The Keychain is locked.' };
    render(<IphoneEntry />);
    const button = await entry('none');

    expect(button.querySelector('[data-status-mark]')).toBeNull();
    expect(commands()).not.toContain('bridge_status');
  });

  it('retries a failed first read so a paired user does not stay on Not paired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.phones = [harborline];
    bridge.isReadFailing = true;
    render(<IphoneEntry />);
    await entry('none');

    bridge.isReadFailing = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    await entry('live');
  });

  it('keeps the clock running so the offline age in the tooltip climbs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.phones = [northwind];
    render(<IphoneEntry />);
    const button = await entry('offline');
    fireEvent.focus(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('iPhone offline 14m');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000);
    });

    expect(screen.getByRole('tooltip').textContent).toMatch(/^iPhone offline 1[67]m$/);
  });

  it('keeps polling the status for someone who had phones when the keys are unreadable, and shows the recovery', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.phones = [];
    bridge.priorPhones = 1;
    bridge.fault = { code: 'keychain_unavailable', message: 'The Keychain is locked.' };
    render(<IphoneEntry />);
    const button = await entry('fault');
    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'danger',
    );

    bridge.phones = [harborline];
    bridge.fault = null;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });

    expect(commands()).toContain('bridge_status');
    await entry('live');
  });

  it('shows a green dot beside the glyph while a phone is live', async () => {
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    const button = await entry('live');

    const dot = button.querySelector('[data-status-mark="dot"]');
    expect(dot?.getAttribute('data-status-tone')).toBe('success');
    expect(button.querySelector('svg')?.contains(dot)).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('iPhone, Live');
  });

  it('shows a yellow dot with the age in its tooltip when every paired phone is offline', async () => {
    bridge.phones = [northwind];
    render(<IphoneEntry />);
    const button = await entry('offline');

    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'warning',
    );
    expect(button.getAttribute('aria-label')).toBe('iPhone, Offline');
    fireEvent.focus(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('iPhone offline 14m');
  });

  it('turns from green to yellow on the next poll when the live phone goes away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    await entry('live');

    bridge.phones = [{ ...harborline, liveSince: null }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });

    const button = await entry('offline');
    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'warning',
    );
  });

  it('shows a red dot when pairing is broken for a paired phone', async () => {
    bridge.phones = [harborline];
    bridge.fault = { code: 'key_mismatch', message: 'The pairing file and the Keychain differ.' };
    render(<IphoneEntry />);
    const button = await entry('fault');

    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'danger',
    );
    expect(button.getAttribute('aria-label')).toBe("iPhone, Pairing isn't available");
  });

  it('keeps the last known state and its dot when a read fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    await entry('live');

    bridge.isReadFailing = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });

    const button = await entry('live');
    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'success',
    );
  });

  it('opens the panel the mock shows: name, state with a dot, last sync, rights and the pinned row', async () => {
    bridge.phones = [northwind];
    render(<IphoneEntry />);

    fireEvent.click(await entry('offline'));

    const panel = await screen.findByRole('dialog', { name: 'iPhone' });
    expect(panel.querySelector('.text-heading')?.textContent).toBe('Northwind iPhone');
    const rows = Array.from(panel.querySelectorAll('dt')).map((dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]);
    expect(rows).toEqual([
      ['State', expect.stringMatching(/^Offline since /)],
      ['Last sync', '14m ago'],
      ['Rights', 'Reply and approve'],
    ]);
    expect(panel.querySelector('dd [data-status-tone="warning"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open iPhone settings/ }));

    expect(events.names).toEqual(['goodboy:open-pair-device']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('names the problem in the panel with a short title and state', async () => {
    bridge.phones = [harborline];
    bridge.fault = { code: 'file_unreadable', message: 'A long two sentence explanation. Reset.' };
    render(<IphoneEntry />);

    fireEvent.click(await entry('fault'));

    const panel = await screen.findByRole('dialog', { name: 'iPhone' });
    expect(panel.querySelector('.text-heading')?.textContent).toBe("Pairing isn't available");
    expect(panel.textContent).toContain('Keys unreadable');
    expect(panel.textContent).not.toContain('A long two sentence explanation');
  });

  it('shows the phone seen last when several are paired, or the live one', async () => {
    bridge.phones = [northwind, { ...harborline, name: 'Harborline iPhone' }];
    render(<IphoneEntry />);

    fireEvent.click(await entry('live'));

    const panel = await screen.findByRole('dialog', { name: 'iPhone' });
    expect(panel.querySelector('.text-heading')?.textContent).toBe('Harborline iPhone');
  });

  it('renders nothing when the setting hides it, and reads nothing', async () => {
    useIphoneBarIconStore.setState({ isShown: false });
    bridge.phones = [harborline];
    const view = render(<IphoneEntry />);

    expect(view.container.querySelector('[data-iphone-entry]')).toBeNull();
    expect(commands()).toEqual([]);
  });

  it('only reads the local bridge and never calls the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    await entry('live');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect([...new Set(commands())].sort()).toEqual([
      'bridge_link_hint',
      'bridge_phones',
      'bridge_status',
    ]);
    vi.unstubAllGlobals();
  });
});
