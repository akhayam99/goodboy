// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mountDirName } from './mountDirName';

const MID = '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f';
const OTHER = '3c43f246-856d-4e7d-81d3-e05b5e18a6c5';

const sequence = (values: ReadonlyArray<number>): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
};

describe('mountDirName', () => {
  it('is gb- plus six lowercase base36 characters', () => {
    expect(mountDirName({ mountId: MID })).toMatch(/^gb-[0-9a-z]{6}$/);
    expect(mountDirName({ mountId: OTHER })).toMatch(/^gb-[0-9a-z]{6}$/);
  });

  it('is nine characters long instead of a slug plus a 36 character uuid', () => {
    expect(mountDirName({ mountId: MID })).toHaveLength(9);
  });

  it('maps the random source onto the base36 alphabet', () => {
    const random = sequence([0, 0.5, 0.99, 0.9999999, 1, 10.5 / 36]);

    expect(mountDirName({ mountId: MID, random })).toBe('gb-0izzza');
  });

  it('gives the same name to the same mount and another name to another mount', () => {
    expect(mountDirName({ mountId: MID })).toBe(mountDirName({ mountId: MID }));
    expect(mountDirName({ mountId: MID })).not.toBe(mountDirName({ mountId: OTHER }));
  });

  it('draws a longer suffix on request', () => {
    expect(mountDirName({ mountId: MID, length: 12 })).toMatch(/^gb-[0-9a-z]{12}$/);
  });
});
