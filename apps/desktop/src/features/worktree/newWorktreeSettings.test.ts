import { describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import {
  carryPathsOf,
  carryValueOf,
  setupCommandOf,
  setupOfferKey,
  setupOfferOf,
  setupOfferValueOf,
} from './newWorktreeSettings';

describe('newWorktreeSettings', () => {
  it('keys the offer by its mount', () => {
    const mount = brandId<MountId>({ value: 'mount-1' });

    expect(setupOfferKey({ mountId: mount })).toBe('worktree.setup-offer.mount-1');
  });

  it('reads a carry list and drops anything that is not a path', () => {
    expect(
      carryPathsOf({ raw: JSON.stringify(['.env.local', '', 4, 'config/local.json']) }),
    ).toEqual(['.env.local', 'config/local.json']);
    expect(carryPathsOf({ raw: '{broken' })).toEqual([]);
    expect(carryPathsOf({ raw: '{"a":1}' })).toEqual([]);
    expect(carryPathsOf({ raw: null })).toEqual([]);
    expect(carryPathsOf({ raw: undefined })).toEqual([]);
  });

  it('writes a carry list sorted and without repeats', () => {
    expect(carryValueOf({ paths: ['b.env', 'a.env', 'b.env'] })).toBe('["a.env","b.env"]');
  });

  it('tells a setup that was never saved from one that was cleared', () => {
    expect(setupCommandOf({ raw: null })).toBeUndefined();
    expect(setupCommandOf({ raw: '   ' })).toBeNull();
    expect(setupCommandOf({ raw: ' pnpm install ' })).toBe('pnpm install');
  });

  it('round trips an offer and refuses a damaged one', () => {
    const offer = { command: 'pnpm install', carried: 2, skipped: 1, state: 'offered' } as const;

    expect(setupOfferOf({ raw: setupOfferValueOf({ offer }) })).toEqual(offer);
    expect(
      setupOfferOf({ raw: setupOfferValueOf({ offer: { ...offer, command: null } }) }),
    ).toEqual({ ...offer, command: null });
    expect(
      setupOfferOf({ raw: '{"command":"x","carried":"2","skipped":0,"state":"offered"}' }),
    ).toBeNull();
    expect(
      setupOfferOf({ raw: '{"command":"x","carried":1,"skipped":0,"state":"later"}' }),
    ).toBeNull();
    expect(
      setupOfferOf({ raw: '{"command":"","carried":1,"skipped":0,"state":"offered"}' }),
    ).toBeNull();
    expect(setupOfferOf({ raw: 'nope' })).toBeNull();
    expect(setupOfferOf({ raw: undefined })).toBeNull();
  });
});
