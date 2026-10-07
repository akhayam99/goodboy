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
});
