// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { roleRunOf } from './roleRunOf';

describe('roleRunOf', () => {
  it('starts the named role at once, read as a pick of the user', () => {
    const result = roleRunOf({ text: '  Explain how ledger-core is organized  ', role: 'scout' });

    expect(result).toMatchObject({
      ask: 'Explain how ledger-core is organized',
      preset: null,
      role: 'scout',
      route: { shape: 'lead', row: 1, role: 'scout', presetName: null, why: 'you picked it' },
    });
  });

  it('names the run by the role, in the words of the Kind chip', () => {
    const result = roleRunOf({ text: 'Find one small bug', role: 'scout' });

    expect(result.route.choice).toBe('Agent · Scout');
  });
});
