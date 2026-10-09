// @vitest-environment node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const sources = readdirSync(__dirname)
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => [file, readFileSync(join(__dirname, file), 'utf8')] as const);

describe('the script run drawer wraps long tokens, not words', () => {
  it('finds its own sources', () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  it.each(sources)('%s never breaks a word at any letter', (_file, source) => {
    expect(source).not.toContain('break-all');
  });

  it.each(sources)('%s puts no native title attribute on a button', (_file, source) => {
    expect(source).not.toMatch(/<(?:Button|button)\b[^>]*\btitle=/s);
  });
});
