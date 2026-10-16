// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LensKind } from '../../store';
import { LENS_ICON, LENS_LABEL } from './lens-labels';

const LENSES = Object.keys(LENS_LABEL) as ReadonlyArray<LensKind>;

describe('lens labels', () => {
  it('gives every lens with a label an icon', () => {
    expect(LENSES.length).toBeGreaterThan(0);
    LENSES.forEach((lens) => {
      expect(LENS_ICON[lens]).toBeDefined();
    });
  });
});
