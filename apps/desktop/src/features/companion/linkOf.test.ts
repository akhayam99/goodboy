import { describe, expect, it } from 'vitest';
import type { BridgeStatus, PairedPhone } from './bridge';
import { linkOf } from './linkOf';

const status = (fault: BridgeStatus['fault']): BridgeStatus => ({
  running: true,
  port: 47821,
  enrolledCount: 1,
  isAdvertised: true,
  pendingPairing: null,
  fault,
});

const phone = (patch: Partial<PairedPhone>): PairedPhone => ({
  id: 'key',
  name: 'Harborline iPhone',
  pairedAt: '2026-11-20T10:00:00.000Z',
  lastSeen: '2026-11-27T09:00:00.000Z',
  liveSince: null,
  permissions: { canDecide: true, canMerge: true, canStart: false },
  ...patch,
});

describe('linkOf', () => {
  it('has no state and no dot when no phone is paired', () => {
    expect(linkOf({ status: status(null), phones: [] })).toEqual({ state: 'none', phone: null });
    expect(linkOf({ status: null, phones: [] }).state).toBe('none');
  });

  it('is live when a phone holds a connection', () => {
    const live = phone({ liveSince: '2026-11-27T09:12:00.000Z' });
    expect(linkOf({ status: status(null), phones: [live] })).toEqual({
      state: 'live',
      phone: live,
    });
  });

  it('is offline when every paired phone is disconnected, naming the one seen last', () => {
    const older = phone({
      id: 'a',
      name: 'Northwind iPhone',
      lastSeen: '2026-11-25T09:00:00.000Z',
    });
    const newer = phone({ id: 'b' });
    expect(linkOf({ status: status(null), phones: [older, newer] })).toEqual({
      state: 'offline',
      phone: newer,
    });
  });

  it('prefers the live phone over one seen later', () => {
    const live = phone({
      id: 'a',
      lastSeen: '2026-11-20T09:00:00.000Z',
      liveSince: '2026-11-27T09:12:00.000Z',
    });
    const other = phone({ id: 'b', lastSeen: '2026-11-27T11:00:00.000Z' });
    expect(linkOf({ status: status(null), phones: [other, live] }).phone).toBe(live);
  });

  it('is a fault when the pairing key is unusable and a phone is paired', () => {
    const fault = { code: 'key_mismatch', message: 'no' } as const;
    expect(linkOf({ status: status(fault), phones: [phone({})] }).state).toBe('fault');
  });

  it('stays without a state and a dot when a fault finds no phone paired', () => {
    const fault = { code: 'keychain_unavailable', message: 'no' } as const;
    expect(linkOf({ status: status(fault), phones: [] })).toEqual({ state: 'none', phone: null });
  });
});
