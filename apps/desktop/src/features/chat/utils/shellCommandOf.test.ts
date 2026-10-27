import { describe, expect, it } from 'vitest';
import { shellCommandOf } from './shellCommandOf';

describe('shellCommandOf', () => {
  it.each(['bash', 'sh', 'zsh', 'shell', 'console', 'Bash'])(
    'takes a block tagged %s as written',
    (lang) => {
      expect(shellCommandOf({ lang, content: 'pnpm migrate:up' })).toBe('pnpm migrate:up');
    },
  );

  it('keeps every line of a block of several commands', () => {
    const content = 'cd ledger-core\npnpm install\npnpm test';
    expect(shellCommandOf({ lang: 'bash', content })).toBe(content);
  });

  it('takes the prompt lines of a block that shows a session', () => {
    const content = '$ pnpm test\nPASS postings\n$ git status';
    expect(shellCommandOf({ lang: 'console', content })).toBe('pnpm test\ngit status');
    expect(shellCommandOf({ lang: null, content })).toBe('pnpm test\ngit status');
  });

  it('takes an untagged block that starts like a command', () => {
    expect(shellCommandOf({ lang: null, content: 'pnpm --filter payments-api test' })).toBe(
      'pnpm --filter payments-api test',
    );
    expect(shellCommandOf({ lang: '', content: 'git log --oneline' })).toBe('git log --oneline');
  });

  it('leaves out an untagged block that is not a command', () => {
    expect(shellCommandOf({ lang: null, content: 'Northwind settlement replay' })).toBeNull();
    expect(shellCommandOf({ lang: null, content: '{ "retries": 3 }' })).toBeNull();
  });

  it('leaves out blocks of another language', () => {
    expect(shellCommandOf({ lang: 'ts', content: 'pnpm test' })).toBeNull();
    expect(shellCommandOf({ lang: 'json', content: '{}' })).toBeNull();
  });

  it('leaves out an empty block', () => {
    expect(shellCommandOf({ lang: 'bash', content: '  \n' })).toBeNull();
  });
});
