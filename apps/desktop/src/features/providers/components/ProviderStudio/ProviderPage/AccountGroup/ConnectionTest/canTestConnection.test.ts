// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { canTestConnection } from './canTestConnection';

describe('canTestConnection', () => {
  it('tests the account of anthropic, cursor and codex, and no other provider', () => {
    const testable = PROVIDER_IDS.filter((providerId) => canTestConnection({ providerId }));

    expect(testable).toEqual(['anthropic', 'cursor', 'codex']);
  });
});
