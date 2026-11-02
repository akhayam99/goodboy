// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { needsYouText } from '../../shared/utils/needsYouText';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const DOCS = ['docs/navigation/shell.md', 'docs/concepts.md'] as const;
const UNIT_LINE = /Needs you counts three units.*?The bell is unchanged\./;

type DocParams = {
  readonly path: string;
};

const unitSentenceOf = ({ path }: DocParams): string => {
  const text = readFileSync(join(REPO_ROOT, path), 'utf8').replace(/\s+/g, ' ');
  return text.match(UNIT_LINE)?.[0] ?? '';
};

describe('the docs name the same Needs you units', () => {
  it('says the same sentence in the shell doc and the concepts doc', () => {
    const [shell, concepts] = DOCS.map((path) => unitSentenceOf({ path }));
    expect(shell).not.toBe('');
    expect(shell).toBe(concepts);
  });

  it('names the sessions and items wording the code writes', () => {
    const sentence = unitSentenceOf({ path: DOCS[0] });
    expect(sentence).toContain(needsYouText({ count: 2, unit: 'sessions' }));
    expect(sentence).toContain(needsYouText({ count: 4, unit: 'items' }));
    expect(sentence).toContain('3 questions');
  });
});
