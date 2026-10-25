// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SENTENCE =
  'Goodboy runs coding agents side by side on your own repositories, one session for each goal.';

const PLACES: ReadonlyArray<readonly [string, string]> = [
  ['the README', 'README.md'],
  ['the website hero', join('website', 'src', 'sections', 'Hero.tsx')],
  [
    'the Welcome step',
    join(
      'apps',
      'desktop',
      'src',
      'features',
      'onboarding',
      'OnboardingWizard',
      'steps',
      'WelcomeStep.tsx',
    ),
  ],
];

const flat = (path: string): string => readFileSync(join(ROOT, path), 'utf8').replace(/\s+/g, ' ');

describe('Goodboy has one sentence', () => {
  it.each(PLACES)('opens %s with the same sentence', (_name, path) => {
    expect(flat(path)).toContain(SENTENCE);
  });

  it('is one sentence of at most 20 words, with no unexplained acronym', () => {
    expect(SENTENCE.split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(SENTENCE.split(/(?<=[.?!])\s+/)).toHaveLength(1);
    expect(SENTENCE).not.toMatch(/\bADE\b/);
  });
});
