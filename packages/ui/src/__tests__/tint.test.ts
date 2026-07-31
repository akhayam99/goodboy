import { describe, expect, it } from 'vitest';
import { tintClasses, type Tone } from '../tint';

const SEMANTIC_TONES: ReadonlyArray<Tone> = [
  'success',
  'info',
  'warning',
  'danger',
  'primary',
  'accent',
  'merged',
];

describe('tintClasses', () => {
  it.each(SEMANTIC_TONES)('%s follows the shared opacity scale', (tone) => {
    const tint = tintClasses(tone);
    expect(tint.border).toMatch(/\/40$/);
    expect(tint.borderSoft).toMatch(/\/20$/);
    expect(tint.bg).toMatch(/\/10$/);
    expect(tint.bgSoft).toMatch(/\/5$/);
    expect(tint.hoverBorder).toMatch(/^hover:border-\S+\/40$/);
    expect(tint.hoverBg).toMatch(/^hover:bg-\S+\/20$/);
    expect(tint.hoverBgSoft).toMatch(/^hover:bg-\S+\/5$/);
    expect(tint.solid).toMatch(/^bg-\S+ text-\S+-foreground$/);
  });

  it('exposes a muted operations tone for machinery chrome', () => {
    expect(tintClasses('operations')).toMatchObject({
      border: 'border-primary/20',
      bg: 'bg-muted/30',
      icon: 'text-primary/60',
    });
  });
});
