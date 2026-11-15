// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toolStateOf } from './toolStateOf';

describe('toolStateOf', () => {
  it('reads Not set up without a connection', () => {
    expect(toolStateOf({ isConnected: false, hasKey: true, keyCheck: null }).word).toBe(
      'Not set up',
    );
  });

  it('reads Checking until the keychain answered, then Connected or Key missing', () => {
    expect(toolStateOf({ isConnected: true, hasKey: true, keyCheck: null }).kind).toBe('checking');
    expect(
      toolStateOf({ isConnected: true, hasKey: true, keyCheck: { isPresent: true, checkedAt: 1 } })
        .word,
    ).toBe('Connected');
    const missing = toolStateOf({
      isConnected: true,
      hasKey: true,
      keyCheck: { isPresent: false, checkedAt: 1 },
    });
    expect(missing.word).toBe('Key missing');
    expect(missing.tone).toBe('danger');
  });

  it('reads Connected for a tool with no key of its own, like GitHub', () => {
    expect(toolStateOf({ isConnected: true, hasKey: false, keyCheck: null }).word).toBe(
      'Connected',
    );
  });
});
