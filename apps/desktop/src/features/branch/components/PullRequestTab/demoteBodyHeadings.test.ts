import { describe, expect, it } from 'vitest';
import { demoteBodyHeadings } from './demoteBodyHeadings';

const SECTION = 'Description';

describe('demoteBodyHeadings', () => {
  it('drops a first heading that repeats the section label', () => {
    expect(
      demoteBodyHeadings({
        text: '## Description\n\nSplits the member route.',
        sectionLabel: SECTION,
      }),
    ).toBe('Splits the member route.');
  });

  it('turns every other heading into a bold lead-in', () => {
    expect(
      demoteBodyHeadings({
        text: '## Scope\n- Member chat route\n\n### Preview\nDeploy ready.',
        sectionLabel: SECTION,
      }),
    ).toBe('**Scope**\n- Member chat route\n\n**Preview**\nDeploy ready.');
  });

  it('keeps a Description heading that is not the first line', () => {
    expect(demoteBodyHeadings({ text: 'Intro.\n\n# Description', sectionLabel: SECTION })).toBe(
      'Intro.\n\n**Description**',
    );
  });

  it('leaves code fences, hashtags and closing hashes alone', () => {
    expect(
      demoteBodyHeadings({
        text: '```sh\n# not a heading\n```\n#412 is linked\n## Notes ##',
        sectionLabel: SECTION,
      }),
    ).toBe('```sh\n# not a heading\n```\n#412 is linked\n**Notes**');
  });

  it('keeps a four backtick block open across a three backtick example inside it', () => {
    const text = '````md\n```sh\nrun it\n# x\n````\n## After';

    expect(demoteBodyHeadings({ text, sectionLabel: SECTION })).toBe(
      '````md\n```sh\nrun it\n# x\n````\n**After**',
    );
  });

  it('closes a tilde fence only on tildes, never on backticks', () => {
    const text = '~~~\n```\n# still code\n~~~~\n# Heading';

    expect(demoteBodyHeadings({ text, sectionLabel: SECTION })).toBe(
      '~~~\n```\n# still code\n~~~~\n**Heading**',
    );
  });

  it('does not close a fence on a shorter run or one followed by text', () => {
    const text = '````\n```\n```` not a close\n# still code';

    expect(demoteBodyHeadings({ text, sectionLabel: SECTION })).toBe(text);
  });

  it('runs an unclosed fence to the end of the body', () => {
    const text = 'Intro.\n```ts\n# not a heading\n## nor this';

    expect(demoteBodyHeadings({ text, sectionLabel: SECTION })).toBe(text);
  });

  it('returns the text untouched when it has no heading', () => {
    expect(demoteBodyHeadings({ text: 'Plain body.', sectionLabel: SECTION })).toBe('Plain body.');
  });
});
