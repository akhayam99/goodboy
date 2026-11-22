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

const releaseWithText = ({ version, text }: { readonly version: string; readonly text: string }) =>
  [
    `## Goodboy v${version}`,
    '',
    'A lead sentence for this release.',
    '',
    '### Fixed',
    '',
    `- ${text} <!-- gb area=app -->`,
  ].map((line, index) => ({ number: index + 1, text: line }));

const denylistHits = ({ version, text }: { readonly version: string; readonly text: string }) =>
  lintRelease({ lines: releaseWithText({ version, text }) }).filter(
    (violation) => violation.rule === 'denylist',
  );

describe('lintRelease what stays out', () => {
  it('flags a source file name from 0.41.0 on, not before', () => {
    expect(
      denylistHits({ version: '0.41.0', text: 'Settings no longer reloads useAgents.tsx.' }),
    ).toHaveLength(1);
    expect(
      denylistHits({ version: '0.40.9', text: 'A conflict in Panel.tsx shows the file.' }),
    ).toEqual([]);
  });

  it('flags a repository path', () => {
    expect(
      denylistHits({ version: '0.41.0', text: 'Reads from apps/desktop on launch.' }),
    ).toHaveLength(1);
  });

  it('flags code vocabulary and filler', () => {
    expect(denylistHits({ version: '0.41.0', text: 'A ratchet guards the Board.' })).toHaveLength(
      1,
    );
    expect(denylistHits({ version: '0.41.0', text: 'Generic copy improvements.' })).toHaveLength(1);
    expect(denylistHits({ version: '0.41.0', text: 'Seamlessly opens the Board.' })).toHaveLength(
      1,
    );
  });

  it('accepts plain screen language', () => {
    expect(
      denylistHits({ version: '0.41.0', text: 'The Board keeps its lane when a session moves.' }),
    ).toEqual([]);
  });
});
