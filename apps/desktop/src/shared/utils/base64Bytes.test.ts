import { describe, expect, it } from 'vitest';
import { base64Bytes } from './base64Bytes';

describe('base64Bytes', () => {
  it('returns the raw bytes, not a binary string', () => {
    expect([...base64Bytes({ data: btoa('ok\n') })]).toEqual([111, 107, 10]);
  });

  it('keeps every byte of a multi-byte character, so a decoder can join them later', () => {
    const check = String.fromCharCode(0xe2, 0x9c, 0x93);

    expect([...base64Bytes({ data: btoa(check) })]).toEqual([0xe2, 0x9c, 0x93]);
    expect(new TextDecoder('utf-8').decode(base64Bytes({ data: btoa(check) }))).toBe('✓');
  });

  it('returns nothing for an empty payload', () => {
    expect(base64Bytes({ data: '' }).length).toBe(0);
  });
});
