import { describe, expect, it } from 'vitest';
import { getMidModel } from './cli-defaults';

describe('getMidModel', () => {
  it('skips cursor mid models that only spawn through Max Mode', () => {
    expect(getMidModel('cursor')).toBe('sonnet-4.6');
  });

  it('keeps the codex mid model unchanged', () => {
    expect(getMidModel('codex')).toBe('gpt-5.6-terra');
  });
});
