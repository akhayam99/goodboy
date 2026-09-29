// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { releaseImageRequests } from './prefetchReleaseImages';
import { parseChangelog } from './parseChangelog';
import type { ReleaseEntry } from './parseChangelog';

const parseOne = ({ body }: { readonly body: string }): ReleaseEntry => {
  const [release] = parseChangelog({ text: `## Goodboy v0.10.0\n\n${body}` });
  if (release === undefined) {
    throw new Error('expected one parsed release');
  }
  return release;
};

describe('releaseImageRequests', () => {
  it('requests only the after pair for a New entry with an image', () => {
    const release = parseOne({
      body: [
        'A short opening sentence.',
        '',
        '### New',
        '',
        '#### A picture worth a look',
        '<!-- gb area=app image=scroll-fade pr=1 -->',
        '',
        'It looks different now.',
      ].join('\n'),
    });

    expect(releaseImageRequests({ release })).toEqual([
      { version: '0.10.0', file: 'scroll-fade-after-dark.webp' },
      { version: '0.10.0', file: 'scroll-fade-after-light.webp' },
    ]);
  });

  it('requests the before and after pairs for an Improved entry with an image', () => {
    const release = parseOne({
      body: [
        'A short opening sentence.',
        '',
        '### Improved',
        '',
        '#### A picture worth a look',
        '<!-- gb area=app image=crumb-menu pr=1 -->',
        '',
        'It looks different now.',
      ].join('\n'),
    });

    expect(releaseImageRequests({ release })).toEqual([
      { version: '0.10.0', file: 'crumb-menu-before-dark.webp' },
      { version: '0.10.0', file: 'crumb-menu-before-light.webp' },
      { version: '0.10.0', file: 'crumb-menu-after-dark.webp' },
      { version: '0.10.0', file: 'crumb-menu-after-light.webp' },
    ]);
  });

  it('requests nothing for an entry without an image, or a markdown-shaped release', () => {
    const withoutImage = parseOne({
      body: [
        'A short opening sentence.',
        '',
        '### New',
        '',
        '#### No picture here',
        '<!-- gb area=app pr=1 -->',
        '',
        'Still true.',
      ].join('\n'),
    });
    expect(releaseImageRequests({ release: withoutImage })).toEqual([]);

    const markdown = parseOne({ body: 'Some free-form text with no sections at all.' });
    expect(releaseImageRequests({ release: markdown })).toEqual([]);
  });
});
