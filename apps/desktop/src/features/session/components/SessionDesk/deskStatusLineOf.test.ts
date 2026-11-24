import { describe, expect, it } from 'vitest';
import { NAMES } from '../../../../shared/utils/names';
import { deskStatusLineOf } from './deskStatusLineOf';

describe('deskStatusLineOf', () => {
  it('counts the sections that hold something', () => {
    expect(deskStatusLineOf({ needsYou: 1, now: 0, next: 2 })).toBe(
      `${NAMES.needsYou} 1 · ${NAMES.nextSection} 2`,
    );
  });

  it('names the Overview when nothing counts, never a project state', () => {
    expect(deskStatusLineOf({ needsYou: 0, now: 0, next: 0 })).toBe(NAMES.overview);
  });
});
