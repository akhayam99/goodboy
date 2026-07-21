import { describe, expect, it } from 'vitest';
import { MARKER_ACCENT, type MarkerAccent, type Tone } from './marker-accents';

const TONES: ReadonlyArray<Tone> = [
  'primary',
  'merged',
  'info',
  'success',
  'warning',
  'danger',
  'operations',
  'neutral',
];

describe('MARKER_ACCENT', () => {
  it.each(TONES)('%s exposes every accent class', (tone) => {
    expect(MARKER_ACCENT[tone]).toEqual(
      expect.objectContaining<MarkerAccent>({
        border: expect.any(String),
        borderSoft: expect.any(String),
        hoverBorder: expect.any(String),
        bg: expect.any(String),
        bgSoft: expect.any(String),
        hoverBg: expect.any(String),
        hoverBgSoft: expect.any(String),
        text: expect.any(String),
        icon: expect.any(String),
      }),
    );
  });

  it.each(TONES.slice(0, 6))('%s follows the shared opacity scale', (tone) => {
    expect(MARKER_ACCENT[tone].border).toMatch(/\/40$/);
    expect(MARKER_ACCENT[tone].borderSoft).toMatch(/\/20$/);
    expect(MARKER_ACCENT[tone].bg).toMatch(/\/10$/);
    expect(MARKER_ACCENT[tone].bgSoft).toMatch(/\/5$/);
    expect(MARKER_ACCENT[tone].hoverBorder).toMatch(/^hover:border-\S+\/40$/);
    expect(MARKER_ACCENT[tone].hoverBg).toMatch(/^hover:bg-\S+\/20$/);
    expect(MARKER_ACCENT[tone].hoverBgSoft).toMatch(/^hover:bg-\S+\/5$/);
  });

  it('keeps muted operation and neutral surfaces', () => {
    expect(MARKER_ACCENT.operations).toMatchObject({
      border: 'border-primary/20',
      borderSoft: 'border-primary/20',
      hoverBorder: 'hover:border-primary/40',
      bg: 'bg-muted/30',
      bgSoft: 'bg-muted/30',
      hoverBg: 'hover:bg-muted/50',
      hoverBgSoft: 'hover:bg-muted/30',
    });
    expect(MARKER_ACCENT.neutral).toMatchObject({
      border: 'border-border',
      borderSoft: 'border-border',
      hoverBorder: 'hover:border-border',
      bg: 'bg-muted',
      bgSoft: 'bg-muted',
      hoverBg: 'hover:bg-muted',
      hoverBgSoft: 'hover:bg-muted/50',
    });
  });
});
