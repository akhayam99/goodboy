import { describe, expect, it } from 'vitest';
import { healMarkdownPrefix } from './healMarkdownPrefix';

const heal = (text: string, cut: number, isComplete = false): string =>
  healMarkdownPrefix({ text, cut, isComplete }).trimEnd();

describe('healMarkdownPrefix', () => {
  it('cuts prose at a word end', () => {
    expect(heal('alpha beta gamma', 8)).toBe('alpha');
    expect(heal('alpha beta gamma', 10)).toBe('alpha beta');
  });

  it('never shows the unfinished last word of a growing text', () => {
    expect(heal('alpha beta', 10)).toBe('alpha');
  });

  it('shows everything once the text is complete', () => {
    expect(heal('alpha beta', 10, true)).toBe('alpha beta');
  });

  it('holds an open bold span until it closes', () => {
    const text = 'Run **verify-schema before** deploy';
    expect(heal(text, 18)).toBe('Run');
    expect(heal(text, 33)).toBe('Run **verify-schema before**');
  });

  it('holds an open code span until it closes', () => {
    const text = 'The check is `verify-schema` today';
    expect(heal(text, 20)).toBe('The check is');
    expect(heal(text, 29)).toBe('The check is `verify-schema`');
  });

  it('keeps asterisks inside a code span out of the bold count', () => {
    const text = 'Use `a ** b` here now';
    expect(heal(text, 17)).toBe('Use `a ** b` here');
  });

  it('holds an open link until its target closes', () => {
    const text = 'See [the guide](https://example.com/a) now';
    expect(heal(text, 9)).toBe('See');
    expect(heal(text, 25)).toBe('See');
    expect(heal(text, 38)).toBe('See [the guide](https://example.com/a)');
  });

  it('shows a closed bracket pair that is not a link', () => {
    expect(heal('Item [done] and more', 14)).toBe('Item [done]');
  });

  it('holds a table until it is closed, then shows every row at once', () => {
    const table = '| Step | Time |\n|---|---|\n| Add | 40 ms |\n| Fill | 6 min |';
    const text = `Plan:\n\n${table}\n\nDone now`;
    expect(heal(text, 6)).toBe('Plan:');
    expect(heal(text, 12)).toBe(`Plan:\n\n${table}`);
    expect(heal(text, 52)).toBe(`Plan:\n\n${table}`);
    expect(heal(text, 71)).toBe(`Plan:\n\n${table}\n\nDone`);
  });

  it('keeps a table that may still grow hidden while the text is not complete', () => {
    const text = 'Plan:\n\n| Step | Time |\n|---|---|\n| Add | 40 ms |\n';
    expect(heal(text, text.length)).toBe('Plan:');
    expect(heal(text, text.length, true)).toBe(text.trimEnd());
    expect(heal(`${text}| Fill | 6 min |`, text.length + 8)).toBe('Plan:');
  });

  it('shows pipe lines that are not a table as prose', () => {
    const text = '| one\ntwo three four\nfive';
    expect(heal(text, 5)).toBe('| one');
    expect(heal(text, 12)).toBe('| one\ntwo');
  });

  it('cuts an open fence at whole lines', () => {
    const text = 'Run:\n\n```sql\nALTER TABLE a\n  ADD COLUMN b;\n```\n\nAfter it';
    expect(heal(text, 20)).toBe('Run:\n\n```sql');
    expect(heal(text, 30)).toBe('Run:\n\n```sql\nALTER TABLE a');
    expect(heal(text, 48)).toBe('Run:\n\n```sql\nALTER TABLE a\n  ADD COLUMN b;\n```');
  });

  it('does not treat bold markers inside a fence as open spans', () => {
    const text = '```\na ** b\nc\n```\nend now';
    expect(heal(text, 11)).toBe('```\na ** b');
  });

  it('returns an empty prefix when the first word is not done', () => {
    expect(heal('abcdefgh', 3)).toBe('');
  });
});
