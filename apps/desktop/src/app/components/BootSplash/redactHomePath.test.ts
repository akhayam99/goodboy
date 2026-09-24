import { describe, expect, it } from 'vitest';
import { redactHomePath } from './redactHomePath';

describe('redactHomePath', () => {
  it('replaces a macOS, Linux or Windows home prefix with a tilde', () => {
    expect(redactHomePath({ text: 'open /Users/dev/.goodboy/data.db failed' })).toBe(
      'open ~/.goodboy/data.db failed',
    );
    expect(redactHomePath({ text: 'at /home/dev/app/boot.ts:4' })).toBe('at ~/app/boot.ts:4');
    expect(redactHomePath({ text: 'C:\\Users\\dev\\AppData\\goodboy' })).toBe(
      '~\\AppData\\goodboy',
    );
  });

  it('leaves text without a home path untouched', () => {
    expect(redactHomePath({ text: 'migration 164 failed' })).toBe('migration 164 failed');
  });
});
