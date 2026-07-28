// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { cursorMaxModeAdvisory } from './cursorMaxModeAdvisory';

describe('cursorMaxModeAdvisory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks a model for one account and clears it after success', () => {
    cursorMaxModeAdvisory.mark({ accountId: 'alice', model: 'gpt-5.5' });

    expect(cursorMaxModeAdvisory.has({ accountId: 'alice', model: 'gpt-5.5' })).toBe(true);
    expect(cursorMaxModeAdvisory.has({ accountId: 'bob', model: 'gpt-5.5' })).toBe(false);

    cursorMaxModeAdvisory.clear({ accountId: 'alice', model: 'gpt-5.5' });

    expect(cursorMaxModeAdvisory.has({ accountId: 'alice', model: 'gpt-5.5' })).toBe(false);
  });

  it('clears every advisory when the Cursor account changes', () => {
    cursorMaxModeAdvisory.mark({ accountId: 'alice', model: 'gpt-5.5' });
    cursorMaxModeAdvisory.mark({ accountId: 'bob', model: 'opus-5' });

    cursorMaxModeAdvisory.clearAll({});

    expect(cursorMaxModeAdvisory.has({ accountId: 'alice', model: 'gpt-5.5' })).toBe(false);
    expect(cursorMaxModeAdvisory.has({ accountId: 'bob', model: 'opus-5' })).toBe(false);
  });
});
