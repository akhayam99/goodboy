import { describe, expect, it } from 'vitest';
import { lintRelease } from './lintRelease';

type MetaParams = {
  readonly meta: string;
};

const releaseWithMeta = ({ meta }: MetaParams) =>
  [
    '## Goodboy v9.9.9',
    '',
    'A lead sentence for this release.',
    '',
    '### Improved',
    '',
    '#### A clearer light mode',
    meta,
    '',
    'Light mode separates the page and cards by tone.',
  ].map((text, index) => ({ number: index + 1, text }));

const rulesFor = ({ meta }: MetaParams) =>
  lintRelease({ lines: releaseWithMeta({ meta }) }).map((violation) => violation.rule);

describe('lintRelease picture theme', () => {
  it('accepts theme=light next to an image', () => {
    expect(rulesFor({ meta: '<!-- gb area=app image=v1-overview theme=light -->' })).toEqual([]);
  });

  it('flags a theme that is not light or dark', () => {
    expect(rulesFor({ meta: '<!-- gb area=app image=v1-overview theme=sepia -->' })).toContain(
      'meta-theme-format',
    );
  });

  it('flags a theme without an image', () => {
    expect(rulesFor({ meta: '<!-- gb area=app theme=light -->' })).toContain(
      'meta-theme-without-image',
    );
  });
});
