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
  it.each(SEMANTIC_TONES)('%s reads its fills and edge from the tone steps', (tone) => {
    const tint = tintClasses(tone);
    expect(tint.border).toBe(`border-${tone}-edge`);
    expect(tint.borderSoft).toBe(`border-${tone}-edge`);
    expect(tint.ring).toBe(`ring-${tone}-edge`);
    expect(tint.ringStrong).toBe(`ring-${tone}-solid`);
    expect(tint.bg).toBe(`bg-${tone}-subtle`);
    expect(tint.bgSoft).toBe(`bg-${tone}-wash`);
    expect(tint.hoverBorder).toBe(`hover:border-${tone}-edge`);
    expect(tint.hoverBg).toBe('hover:bg-hover');
    expect(tint.hoverRing).toBe(`hover:ring-${tone}-solid`);
    expect(tint.hoverBgSoft).toBe(`hover:bg-${tone}-wash`);
    expect(tint.solid).toBe(`bg-${tone}-solid text-on-${tone} [&_svg]:text-current`);
    expect(tint.rail).toBe(`border-l-${tone}`);
  });

  it.each<Tone>(['unread', ...SEMANTIC_TONES])(
    '%s never reaches for an opacity modifier',
    (tone) => {
      const values = Object.values(tintClasses(tone));
      expect(values.filter((value) => value.includes('/'))).toEqual([]);
    },
  );

  it('fills unread from the primary steps and keeps its own quieter dot and text', () => {
    expect(tintClasses('unread')).toMatchObject({
      bg: 'bg-primary-subtle',
      bgSoft: 'bg-primary-wash',
      border: 'border-primary-edge',
      ringStrong: 'ring-unread',
      dot: 'bg-unread',
      text: 'text-unread',
      solid: 'bg-primary-solid text-on-primary [&_svg]:text-current',
    });
  });

  it('keeps neutral chips one step inside any parent with the relative fill', () => {
    const neutral = tintClasses('neutral');
    expect(neutral.bg).toBe('bg-fill');
    expect(neutral.bgSoft).toBe('bg-fill');
    expect(neutral.solid).toBe('bg-fill text-foreground');
    expect(neutral.rail).toBe('border-l-border');
  });

  it('reads the draft tone from the TINT record, not a hardcoded coverage list', () => {
    expect(tintClasses('draft').bg).toBe('bg-draft-subtle');
  });

  it('exposes a draft tone bound to the draft token, not indigo hardcodes', () => {
    expect(tintClasses('draft')).toMatchObject({
      bg: 'bg-draft-subtle',
      bgSoft: 'bg-draft-wash',
      ring: 'ring-draft-edge',
      border: 'border-draft-edge',
      borderSoft: 'border-draft-edge',
      hoverBorder: 'hover:border-draft-edge',
      hoverRing: 'hover:ring-draft-solid',
      hoverBg: 'hover:bg-hover',
      hoverBgSoft: 'hover:bg-draft-wash',
      hoverText: 'hover:text-draft',
      text: 'text-draft',
      icon: 'text-draft',
      dot: 'bg-draft',
      solid: 'bg-draft-solid text-on-draft [&_svg]:text-current',
    });
  });
});
