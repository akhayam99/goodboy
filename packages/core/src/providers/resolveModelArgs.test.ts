import { describe, expect, it } from 'vitest';
import { resolveModelArgs } from './resolveModelArgs';

describe('resolveModelArgs', () => {
  it('includes Max Mode for Cursor combinations that require it', () => {
    expect(
      resolveModelArgs({
        provider: 'cursor',
        selection: { key: 'gpt-5.5', effort: 'high' },
      }),
    ).toEqual({
      args: ['--model', 'gpt-5.5-high'],
      maxMode: true,
    });
  });

  it('keeps Max Mode when Cursor effort is clamped', () => {
    expect(
      resolveModelArgs({
        provider: 'cursor',
        selection: { key: 'gpt-5.5', effort: 'max' },
      }),
    ).toEqual({
      args: ['--model', 'gpt-5.5-high'],
      maxMode: true,
      clamped: { requested: 'max', applied: 'high' },
    });
  });

  it('omits Max Mode for Cursor combinations that do not require it', () => {
    const resolved = resolveModelArgs({
      provider: 'cursor',
      selection: { key: 'composer-2.5' },
    });

    expect(resolved).toEqual({
      args: ['--model', 'composer-2.5'],
    });
    expect(resolved).not.toHaveProperty('maxMode');
  });
});
