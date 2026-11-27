import { describe, expect, it } from 'vitest';
import type { BridgeFault, PairedPhone } from './bridge';
import { linkWordOf } from './linkWordOf';
import { phoneStateLineOf } from './phoneStateLineOf';
import { phoneStateTextOf } from './phoneStateTextOf';
import { phoneSyncTextOf } from './phoneSyncTextOf';
import { faultStateOf } from './components/IphoneEntry/faultStateOf';

const NOW = new Date(2026, 10, 27, 15, 0, 0).getTime();

const phone = (patch: Partial<PairedPhone>): PairedPhone => ({
  id: 'key',
  name: 'Harborline iPhone',
  pairedAt: new Date(2026, 10, 20, 10, 0, 0).toISOString(),
  lastSeen: new Date(2026, 10, 27, 14, 46, 0).toISOString(),
  liveSince: null,
  permissions: { canDecide: true, canMerge: true, canStart: false },
  ...patch,
});

describe('the words for a phone, from one place', () => {
  it('names the link states once', () => {
    expect(linkWordOf({ state: 'live' })).toBe('Live');
    expect(linkWordOf({ state: 'offline' })).toBe('Offline');
    expect(linkWordOf({ state: 'fault' })).toBe("Pairing isn't available");
    expect(linkWordOf({ state: 'none' })).toBe('Not paired');
  });

  it('says live since the connection opened and the last sync as just now', () => {
    const live = phone({ liveSince: new Date(2026, 10, 27, 9, 12, 0).toISOString() });

    expect(phoneStateTextOf({ phone: live, now: NOW, isFaulted: false })).toMatch(/^Live since /);
    expect(phoneSyncTextOf({ phone: live, now: NOW })).toBe('just now');
  });

  it('says offline since the last time seen, with the age of the last sync', () => {
    const offline = phone({});

    expect(phoneStateTextOf({ phone: offline, now: NOW, isFaulted: false })).toMatch(
      /^Offline since /,
    );
    expect(phoneSyncTextOf({ phone: offline, now: NOW })).toBe('14m ago');
  });

  it('puts a phone seen yesterday under yesterday, never a bare clock', () => {
    const old = phone({ lastSeen: new Date(2026, 10, 26, 18, 20, 0).toISOString() });

    expect(phoneStateTextOf({ phone: old, now: NOW, isFaulted: false })).toMatch(
      /^Offline since yesterday, /,
    );
  });

  it('says a phone never seen has no sync', () => {
    const fresh = phone({ lastSeen: null });

    expect(phoneStateLineOf({ phone: fresh, now: NOW, isFaulted: false })).toBe(
      'Offline. Last sync never.',
    );
  });

  it('says cannot connect for every phone while pairing is broken', () => {
    expect(phoneStateLineOf({ phone: phone({}), now: NOW, isFaulted: true })).toBe(
      "Can't connect. Last sync 14m ago.",
    );
  });

  it('gives each fault a short state', () => {
    const fault = (code: BridgeFault['code']): BridgeFault => ({ code, message: 'long text' });

    expect(faultStateOf({ fault: fault('file_unreadable') })).toBe('Keys unreadable');
    expect(faultStateOf({ fault: fault('keychain_unavailable') })).toBe('Keychain unavailable');
    expect(faultStateOf({ fault: fault('key_mismatch') })).toBe("Keys don't match");
  });
});
