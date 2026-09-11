import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { mountDirName } from './mountDirName';
import { sanitizeSlug } from './sanitizeSlug';

const MID = '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f' as MountId;

describe('mountDirName', () => {
  it('keeps a slash out of the directory name', () => {
    expect(mountDirName({ sessionSlug: 'alice/fix-parser', mountId: MID })).toBe(
      `alice-fix-p-${MID}`,
    );
  });

  it('returns a name the backend sanitizer leaves untouched', () => {
    const name = mountDirName({ sessionSlug: 'Alice/Fix   Parser', mountId: MID });

    expect(sanitizeSlug(name)).toBe(name);
  });

  it('falls back to the mount id when the slug has nothing usable', () => {
    expect(mountDirName({ sessionSlug: '***', mountId: MID })).toBe(MID);
  });

  it('stays within the backend directory-name budget', () => {
    const name = mountDirName({ sessionSlug: 'a'.repeat(80), mountId: MID });

    expect(name.length).toBeLessThanOrEqual(48);
  });
});
