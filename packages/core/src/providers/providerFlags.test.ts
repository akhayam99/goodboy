import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { getDefaultBinary } from './cli-defaults';
import { PROVIDER_FLAGS, providerFlags, providersOnSameBinary } from './providerFlags';

const idsWhere = (test: (id: ProviderId) => boolean): ReadonlyArray<ProviderId> =>
  PROVIDER_IDS.filter(test);

describe('PROVIDER_FLAGS', () => {
  it('has one row for every provider id', () => {
    expect(Object.keys(PROVIDER_FLAGS).sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it('names the binary each provider runs, and getDefaultBinary reads the same row', () => {
    expect(
      Object.fromEntries(PROVIDER_IDS.map((id) => [id, providerFlags({ id }).binary])),
    ).toEqual({
      anthropic: 'claude',
      cursor: 'cursor-agent',
      codex: 'codex',
      gemini: 'agy',
      copilot: 'copilot',
      opencode: 'opencode',
      openrouter: 'opencode',
      moonshot: 'opencode',
    });
    for (const id of PROVIDER_IDS) {
      expect(getDefaultBinary(id), id).toBe(providerFlags({ id }).binary);
    }
  });

  it('groups the providers that share one binary, and nobody else', () => {
    expect(providersOnSameBinary({ id: 'opencode' })).toEqual([
      'opencode',
      'openrouter',
      'moonshot',
    ]);
    expect(providersOnSameBinary({ id: 'moonshot' })).toEqual([
      'opencode',
      'openrouter',
      'moonshot',
    ]);
    expect(providersOnSameBinary({ id: 'anthropic' })).toEqual(['anthropic']);
    expect(providersOnSameBinary({ id: 'gemini' })).toEqual(['gemini']);
    expect(providersOnSameBinary({ id: 'copilot' })).toEqual(['copilot']);
  });

  it('gives a store status slot to the four providers that have one, each its own', () => {
    const slotted = idsWhere((id) => providerFlags({ id }).statusSlot !== null);
    expect(slotted).toEqual(['anthropic', 'cursor', 'codex', 'gemini']);
    const slots = slotted.map((id) => providerFlags({ id }).statusSlot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('replays the transcript as text for cursor, codex and gemini only', () => {
    expect(idsWhere((id) => providerFlags({ id }).shouldReplayHistoryAsText)).toEqual([
      'cursor',
      'codex',
      'gemini',
    ]);
  });

  it('offers an account test for anthropic, cursor and codex only', () => {
    expect(idsWhere((id) => providerFlags({ id }).hasAccountTest)).toEqual([
      'anthropic',
      'cursor',
      'codex',
    ]);
  });
});
