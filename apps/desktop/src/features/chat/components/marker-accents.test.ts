import { describe, expect, it } from 'vitest';
import { MARKER_ACCENT, type MarkerAccent, type MarkerType, type Tone } from './marker-accents';

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

const MARKER_TONES: Readonly<Record<MarkerType, Tone>> = {
  plan: 'primary',
  clusters: 'merged',
  handoff: 'info',
  resolve: 'success',
  wontfix: 'warning',
  error: 'danger',
};

const MARKERS: ReadonlyArray<MarkerType> = [
  'plan',
  'clusters',
  'handoff',
  'resolve',
  'wontfix',
  'error',
];

describe('MARKER_ACCENT', () => {
  it.each(TONES)('%s exposes every accent class', (tone) => {
    expect(MARKER_ACCENT[tone]).toEqual(
      expect.objectContaining<MarkerAccent>({
        border: expect.any(String),
        borderSoft: expect.any(String),
        bg: expect.any(String),
        bgSoft: expect.any(String),
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
  });

  it('keeps muted operation and neutral surfaces', () => {
    expect(MARKER_ACCENT.operations).toMatchObject({
      border: 'border-primary/20',
      borderSoft: 'border-primary/20',
      bg: 'bg-muted/30',
      bgSoft: 'bg-muted/30',
    });
    expect(MARKER_ACCENT.neutral).toMatchObject({
      border: 'border-border',
      borderSoft: 'border-border',
      bg: 'bg-muted',
      bgSoft: 'bg-muted',
    });
  });

  it.each(MARKERS)('%s aliases its semantic tone', (marker) => {
    expect(MARKER_ACCENT[marker]).toBe(MARKER_ACCENT[MARKER_TONES[marker]]);
  });
});
