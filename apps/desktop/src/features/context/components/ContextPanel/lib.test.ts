import { describe, expect, it } from 'vitest';
import type { ContextSlot } from '@goodboy/types';
import { normalizeFilesSlot } from './lib';

const makeSlot = (value: string): ContextSlot => ({ key: 'files', value, enabled: true });

describe('normalizeFilesSlot', () => {
  it('returns the slot unchanged when there is no working dir', () => {
    const slot = makeSlot('/home/u/proj/a.ts');
    expect(normalizeFilesSlot(slot, null)).toBe(slot);
  });

  it('returns the slot unchanged for an empty value', () => {
    const slot = makeSlot('');
    expect(normalizeFilesSlot(slot, '/home/u/proj')).toBe(slot);
  });

  it('strips the working dir prefix from each path', () => {
    const slot = makeSlot('/home/u/proj/a.ts\n/home/u/proj/b.ts');
    expect(normalizeFilesSlot(slot, '/home/u/proj').value).toBe('a.ts\nb.ts');
  });

  it('handles a working dir with a trailing slash', () => {
    const slot = makeSlot('/home/u/proj/a.ts');
    expect(normalizeFilesSlot(slot, '/home/u/proj/').value).toBe('a.ts');
  });

  it('leaves paths outside the working dir untouched', () => {
    const slot = makeSlot('/home/u/proj/a.ts\n/etc/hosts');
    expect(normalizeFilesSlot(slot, '/home/u/proj').value).toBe('a.ts\n/etc/hosts');
  });

  it('returns the same reference when nothing changes', () => {
    const slot = makeSlot('a.ts\nb.ts');
    expect(normalizeFilesSlot(slot, '/home/u/proj')).toBe(slot);
  });
});
