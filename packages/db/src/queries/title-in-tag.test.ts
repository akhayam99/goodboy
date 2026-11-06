import { describe, expect, it } from 'vitest';
import { titleInTag } from './title-in-tag';

describe('titleInTag', () => {
  it.each([
    ['<title>Block double credits</title>', 'Block double credits'],
    ['noise <title>  Block double credits \n</title> noise', 'Block double credits'],
    ['<title>first</title><title>second</title>', 'first'],
    ['<title></title>', ''],
    ['<title>unclosed', ''],
    ['no tag at all', ''],
    ['</title>Block<title>', ''],
    ['<title>a<title>b</title>', ''],
    ['<TITLE>Block double credits</TITLE>', ''],
    ['', ''],
  ])('reads %j as %j', (text, expected) => {
    expect(titleInTag({ text })).toBe(expected);
  });

  it('stays linear on a long run of open tags', () => {
    expect(titleInTag({ text: '<title>'.repeat(50_000) })).toBe('');
  });
});
