import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { PROVIDER_ORDER } from './providerOrder';

describe('PROVIDER_ORDER', () => {
  it('keeps its order', () => {
    expect(PROVIDER_ORDER).toEqual([
      'anthropic',
      'cursor',
      'codex',
      'gemini',
      'opencode',
      'openrouter',
      'moonshot',
    ]);
  });

  it('covers every id the registry declares', () => {
    expect(new Set(PROVIDER_ORDER)).toEqual(new Set(PROVIDER_IDS));
  });
});
