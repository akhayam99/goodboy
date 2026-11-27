// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  fault: { code: string; message: string } | null;
};

const bridge: Bridge = vi.hoisted(() => ({ phones: [], fault: null }));

const invoke = vi.hoisted(() =>
  vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
);

const events = vi.hoisted(() => ({ names: new Array<string>() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

vi.mock('../../../../shared/lib/dispatchWindowEvent', () => ({
  dispatchWindowEvent: ({ name }: { name: string }) => {
    events.names.push(name);
  },
}));

import { useIphoneBarIconStore } from '../../iphoneBarIconStore';
import { IphoneEntry } from '.';

const harborline: Phone = {
  id: 'key-harborline',
  name: 'Harborline iPhone',
  pairedAt: '2026-11-20T10:00:00.000Z',
  lastSeen: '2026-11-27T09:12:00.000Z',
  liveSince: '2026-11-27T09:12:00.000Z',
  permissions: { canDecide: true, canMerge: true, canStart: false },
};

const answer = async (cmd: string): Promise<unknown> => {
  if (cmd === 'bridge_status') {
    return {
      running: true,
      port: 47821,
      enrolledCount: bridge.phones.length,
      isAdvertised: true,
      pendingPairing: null,
      fault: bridge.fault,
    };
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

beforeEach(() => {
  bridge.phones = [];
  bridge.fault = null;
  events.names = [];
  invoke.mockReset();
  invoke.mockImplementation(answer);
  useIphoneBarIconStore.setState({ isShown: true });
});

afterEach(() => {
  cleanup();
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

  it('shows a green dot beside the glyph while a phone is live', async () => {
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    const button = await entry('live');

    const dot = button.querySelector('[data-status-mark="dot"]');
    expect(dot?.getAttribute('data-status-tone')).toBe('success');
    expect(button.querySelector('svg')?.contains(dot)).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('iPhone, Live');
  });

  it('shows a yellow dot when every paired phone is offline', async () => {
    bridge.phones = [{ ...harborline, liveSince: null }];
    render(<IphoneEntry />);
    const button = await entry('offline');

    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'warning',
    );
    expect(button.getAttribute('aria-label')).toBe('iPhone, Offline');
  });

  it('shows a red dot when pairing is broken', async () => {
    bridge.phones = [harborline];
    bridge.fault = { code: 'key_mismatch', message: 'The pairing file and the Keychain differ.' };
    render(<IphoneEntry />);
    const button = await entry('fault');

    expect(button.querySelector('[data-status-mark="dot"]')?.getAttribute('data-status-tone')).toBe(
      'danger',
    );
  });

  it('opens a compact panel with the phone, its state, its rights and the way to its settings', async () => {
    bridge.phones = [harborline];
    render(<IphoneEntry />);

    fireEvent.click(await entry('live'));

    const panel = await screen.findByRole('dialog', { name: 'iPhone' });
    expect(panel.textContent).toContain('Harborline iPhone');
    expect(panel.textContent).toMatch(/Live since .* Last sync just now\./);
    expect(panel.textContent).toContain('Reply, approve and merge');
    fireEvent.click(screen.getByRole('button', { name: /Open iPhone settings/ }));

    expect(events.names).toEqual(['goodboy:open-pair-device']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('renders nothing when the setting hides it', async () => {
    useIphoneBarIconStore.setState({ isShown: false });
    const view = render(<IphoneEntry />);

    expect(view.container.querySelector('[data-iphone-entry]')).toBeNull();
  });

  it('only reads the local bridge and never calls the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    bridge.phones = [harborline];
    render(<IphoneEntry />);
    await entry('live');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect([...new Set(invoke.mock.calls.map(([cmd]) => cmd))].sort()).toEqual([
      'bridge_phones',
      'bridge_status',
    ]);
    vi.unstubAllGlobals();
  });
});
