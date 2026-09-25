import { describe, expect, it } from 'vitest';
import { tintClasses, type Tone } from '../tint';

const SEMANTIC_TONES: ReadonlyArray<Tone> = [
  'success',
  'info',
  'warning',
  'danger',
  'primary',
  'merged',
  'draft',
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
    expect(tint.solid).toMatch(/^bg-\S+ text-on-tone$/);
    expect(tint.rail).toBe(`border-l-${tone}`);
  });

  it('keeps neutral chips one step inside any parent with the relative fill', () => {
    const neutral = tintClasses('neutral');
    expect(neutral.bg).toBe('bg-fill');
    expect(neutral.bgSoft).toBe('bg-fill');
    expect(neutral.solid).toBe('bg-fill text-foreground');
    expect(neutral.rail).toBe('border-l-border');
  });

  it('reads the draft tone from the TINT record, not a hardcoded coverage list', () => {
    expect(tintClasses('draft').bg).toBe('bg-draft/10');
  });

  it('exposes a draft tone bound to the draft token, not indigo hardcodes', () => {
    expect(tintClasses('draft')).toMatchObject({
      bg: 'bg-draft/10',
      bgSoft: 'bg-draft/5',
      ring: 'ring-draft/20',
      border: 'border-draft/40',
      borderSoft: 'border-draft/20',
      hoverBorder: 'hover:border-draft/40',
      hoverBg: 'hover:bg-draft/20',
      hoverBgSoft: 'hover:bg-draft/5',
      hoverText: 'hover:text-draft',
      text: 'text-draft',
      icon: 'text-draft',
      dot: 'bg-draft',
      solid: 'bg-draft text-on-tone',
    });
  });
});
