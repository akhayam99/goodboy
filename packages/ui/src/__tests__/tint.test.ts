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
    expect(tint.borderSoft).toBe(`border-${tone}/20`);
    expect(tint.bg).toBe(`bg-${tone}-subtle`);
    expect(tint.bgSoft).toBe(`bg-${tone}-wash`);
    expect(tint.hoverBorder).toBe(`hover:border-${tone}-edge`);
    expect(tint.hoverBg).toBe('hover:bg-hover');
    expect(tint.hoverRing).toBe(`hover:ring-${tone}/60`);
    expect(tint.hoverBgSoft).toBe(`hover:bg-${tone}-wash`);
    expect(tint.solid).toBe(`bg-${tone}-solid text-on-${tone} [&_svg]:text-current`);
    expect(tint.rail).toBe(`border-l-${tone}`);
  });

  it('keeps unread on the opacity scale until it has steps of its own', () => {
    expect(tintClasses('unread')).toMatchObject({
      bg: 'bg-unread/10',
      bgSoft: 'bg-unread/5',
      border: 'border-unread/40',
      solid: 'bg-unread text-on-tone [&_svg]:text-current',
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
      ring: 'ring-draft/20',
      border: 'border-draft-edge',
      borderSoft: 'border-draft/20',
      hoverBorder: 'hover:border-draft-edge',
      hoverRing: 'hover:ring-draft/60',
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
