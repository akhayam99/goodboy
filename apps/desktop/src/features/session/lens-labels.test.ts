// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tintClasses, type Tone } from '@goodboy/ui';
import type { LensKind } from '../../store';
import { LENS_ICON, LENS_LABEL, lensIconClass } from './lens-labels';

const LENSES = Object.keys(LENS_LABEL) as ReadonlyArray<LensKind>;
const BRAND_LENSES: ReadonlyArray<LensKind> = [
  'linear',
  'gitlab_issues',
  'jira_issues',
  'github_issue',
  'slack_threads',
];

const TONES: ReadonlyArray<Tone> = [
  'success',
  'info',
  'warning',
  'danger',
  'primary',
  'merged',
  'draft',
  'neutral',
];
const TONE_ICON_CLASSES = TONES.map((tone) => tintClasses(tone).icon);

describe('lens tones', () => {
  it('gives every lens with a label and an icon a tone or a brand color', () => {
    expect(LENSES.length).toBeGreaterThan(0);
    LENSES.forEach((lens) => {
      expect(LENS_ICON[lens]).toBeDefined();
      const iconClass = lensIconClass({ lens });
      const isBrand = BRAND_LENSES.includes(lens);
      expect(
        isBrand ? iconClass.startsWith('text-provider-') : TONE_ICON_CLASSES.includes(iconClass),
      ).toBe(true);
    });
  });

  it('colors a page icon with the tone of its concept', () => {
    expect(lensIconClass({ lens: 'workflows' })).toBe(tintClasses('primary').icon);
    expect(lensIconClass({ lens: 'files' })).toBe(tintClasses('info').icon);
    expect(lensIconClass({ lens: 'questions' })).toBe(tintClasses('warning').icon);
    expect(lensIconClass({ lens: 'terminal' })).toBe(tintClasses('neutral').icon);
  });

  it('keeps the tool brand color on the linked tools whatever the tone', () => {
    BRAND_LENSES.forEach((lens) => {
      expect(lensIconClass({ lens })).toMatch(/^text-provider-/);
      expect(lensIconClass({ lens, isQuiet: true })).toMatch(/^text-provider-/);
    });
  });

  it('mutes a quiet page icon', () => {
    expect(lensIconClass({ lens: 'questions', isQuiet: true })).toBe('text-faint-foreground');
  });
});
