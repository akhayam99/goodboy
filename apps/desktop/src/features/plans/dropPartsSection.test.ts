// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dropPartsSection } from './dropPartsSection';

describe('dropPartsSection', () => {
  it('drops a Parts section and keeps the sections around it', () => {
    expect(
      dropPartsSection({
        text: '## Approach\nRound once.\n\n## Parts\n1. one\n2. two\n\n## Risks\n- drift',
      }),
    ).toBe('## Approach\nRound once.\n\n## Risks\n- drift');
  });

  it('drops a Parts section at the end of the body', () => {
    expect(dropPartsSection({ text: '## Approach\nRound once.\n\n## Parts\n1. one' })).toBe(
      '## Approach\nRound once.\n',
    );
  });

  it('drops the subsections of a Parts section and stops at the next heading of its level', () => {
    expect(dropPartsSection({ text: '# Parts\n## First\nbody\n# Next\nstays' })).toBe(
      '# Next\nstays',
    );
  });

  it('matches the title in any case and ignores other headings', () => {
    expect(dropPartsSection({ text: '## PARTS\n1. one' })).toBe('');
    expect(dropPartsSection({ text: '## Parts of the export\n1. one' })).toBe(
      '## Parts of the export\n1. one',
    );
  });

  it('leaves a body without a Parts heading untouched', () => {
    const text = '## Approach\nThe parts are listed below.\n- a part';
    expect(dropPartsSection({ text })).toBe(text);
  });

  it('keeps a code sample whose text looks like a Parts heading', () => {
    const text =
      '## Approach\n```md\n## Parts\n1. one\n```\nAfter the sample.\n\n## Parts\n1. real';
    expect(dropPartsSection({ text })).toBe(
      '## Approach\n```md\n## Parts\n1. one\n```\nAfter the sample.\n',
    );
  });

  it('does not end a dropped section on a heading inside a code sample', () => {
    const text = '## Parts\n1. one\n~~~\n## Risks\n~~~\n2. two\n## Risks\n- drift';
    expect(dropPartsSection({ text })).toBe('## Risks\n- drift');
  });

  it('closes a fence only with a marker as long as the one that opened it', () => {
    const text = '````\n```\n## Parts\n````\n## Parts\n1. one';
    expect(dropPartsSection({ text })).toBe('````\n```\n## Parts\n````');
  });
});
