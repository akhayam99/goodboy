import { describe, expect, it } from 'vitest';
import { ListVideo, SquareTerminal } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from './conceptIcons';

describe('CONCEPT_TONE', () => {
  it('uses the draft tone for plans', () => {
    expect(CONCEPT_TONE.plans).toBe('draft');
  });
});

describe('CONCEPT_ICONS', () => {
  it('keeps scripts and terminal visually distinct', () => {
    expect(CONCEPT_ICONS.scripts).toBe(ListVideo);
    expect(CONCEPT_ICONS.terminal).toBe(SquareTerminal);
  });
});
