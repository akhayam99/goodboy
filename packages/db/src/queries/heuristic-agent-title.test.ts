// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { heuristicAgentTitle } from './heuristic-agent-title';

describe('heuristicAgentTitle', () => {
  it('simple verb + nouns', () => {
    expect(heuristicAgentTitle({ prompt: 'fix auth bug' })).toBe('fix auth bug');
  });

  it('filters stop words after verb', () => {
    expect(heuristicAgentTitle({ prompt: 'refactor the database layer' })).toBe(
      'refactor database layer',
    );
  });

  it('verb not at position 0, skip prefix words', () => {
    expect(heuristicAgentTitle({ prompt: 'please fix the broken router' })).toBe(
      'fix broken router',
    );
  });

  it('"can you add …", finds verb past stop-word prefix', () => {
    expect(heuristicAgentTitle({ prompt: 'can you add a dark mode toggle' })).toBe('add dark mode');
  });

  it('caps at 3 significant words', () => {
    expect(
      heuristicAgentTitle({ prompt: 'implement oauth2 provider adapter integration layer' }),
    ).toBe('implement oauth2 provider');
  });

  it('verb with single content word returns 2-word title', () => {
    expect(heuristicAgentTitle({ prompt: 'deploy production' })).toBe('deploy production');
  });

  it('stop word between verb and noun is dropped', () => {
    expect(heuristicAgentTitle({ prompt: 'deploy to production' })).toBe('deploy production');
  });

  it('verb itself is always kept even if it looks like a stop word context', () => {
    expect(heuristicAgentTitle({ prompt: 'migrate postgres schema' })).toBe(
      'migrate postgres schema',
    );
  });

  it('strips code fences', () => {
    expect(heuristicAgentTitle({ prompt: 'fix the bug in ```js\nconst x = 1\n``` module' })).toBe(
      'fix bug module',
    );
  });

  it('strips inline backtick spans', () => {
    expect(heuristicAgentTitle({ prompt: 'fix `broken.ts` imports' })).toBe('fix imports');
  });

  it('strips URLs', () => {
    expect(heuristicAgentTitle({ prompt: 'check https://example.com for docs' })).toBe(
      'check docs',
    );
  });

  it('strips markdown bold markers', () => {
    expect(heuristicAgentTitle({ prompt: '**add** user authentication' })).toBe(
      'add user authentication',
    );
  });

  it('strips heading markers', () => {
    expect(heuristicAgentTitle({ prompt: '# fix the auth service' })).toBe('fix auth service');
  });

  it('fallback: 3 significant words when no verb', () => {
    expect(heuristicAgentTitle({ prompt: 'authentication service performance' })).toBe(
      'authentication service performance',
    );
  });

  it('fallback: filters stop words', () => {
    expect(heuristicAgentTitle({ prompt: 'a broken auth flow' })).toBe('broken auth flow');
  });

  it('fallback: "make" is stop-word not action-verb → stripped', () => {
    expect(heuristicAgentTitle({ prompt: 'make auth flow better' })).toBe('auth flow better');
  });

  it('fallback: "need" is stop-word → stripped, setup verb found but lone → falls to fallback', () => {
    expect(heuristicAgentTitle({ prompt: 'need auth setup' })).toBe('auth setup');
  });

  it('empty string → null', () => {
    expect(heuristicAgentTitle({ prompt: '' })).toBeNull();
  });

  it('single action verb with no nouns → null', () => {
    expect(heuristicAgentTitle({ prompt: 'fix' })).toBeNull();
  });

  it('verb + stop-word noun only → null (significant.length < 2 in both paths)', () => {
    expect(heuristicAgentTitle({ prompt: 'fix it' })).toBeNull();
  });

  it('only stop words → null', () => {
    expect(heuristicAgentTitle({ prompt: 'please help me' })).toBeNull();
  });

  it('single non-verb significant word → null', () => {
    expect(heuristicAgentTitle({ prompt: 'authentication' })).toBeNull();
  });

  it('numbers-only multi-word → returned as-is via fallback', () => {
    expect(heuristicAgentTitle({ prompt: '123 456 789' })).toBe('123 456 789');
  });

  it('single number → null', () => {
    expect(heuristicAgentTitle({ prompt: '42' })).toBeNull();
  });

  it('mixed alpha-numeric: verb + number noun', () => {
    expect(heuristicAgentTitle({ prompt: 'fix issue 42' })).toBe('fix issue 42');
  });

  it('newlines collapsed: verb from later line is still found', () => {
    expect(heuristicAgentTitle({ prompt: 'auth service\nfix the bug on line 42' })).toBe(
      'fix bug line',
    );
  });

  it('newlines collapsed: all words contribute to verb slice', () => {
    expect(heuristicAgentTitle({ prompt: 'fix auth\nand also update the UI' })).toBe(
      'fix auth also',
    );
  });

  it('truncates to 300 chars, content beyond 300 ignored', () => {
    const padding = 'x'.repeat(290);
    const prompt = `optimize ${padding} important_stuff_after_limit`;
    const result = heuristicAgentTitle({ prompt: prompt });
    expect(result).not.toBeNull();
    expect(result).toMatch(/^optimize/);
    expect(result).not.toContain('important_stuff_after_limit');
  });

  it('result is at most 3 words', () => {
    const result = heuristicAgentTitle({
      prompt: 'implement authentication provider integration layer',
    });
    expect(result).not.toBeNull();
    expect(result!.split(' ').length).toBeLessThanOrEqual(3);
  });

  it.each([
    ['build docker image', 'build docker image'],
    ['update dependencies lock', 'update dependencies lock'],
    ['generate api client', 'generate api client'],
    ['lint eslint errors', 'lint eslint errors'],
    ['parse json response', 'parse json response'],
    ['format code output', 'format code output'],
    ['bump package version', 'bump package version'],
    ['wire event handler', 'wire event handler'],
    ['expose rest endpoint', 'expose rest endpoint'],
    ['patch memory leak', 'patch memory leak'],
  ])('recognizes verb in "%s"', (prompt, expected) => {
    expect(heuristicAgentTitle({ prompt: prompt })).toBe(expected);
  });

  it('output is lowercase (input is lowercased internally)', () => {
    const result = heuristicAgentTitle({ prompt: 'Fix The Auth Bug' });
    expect(result).toBe('fix auth bug');
  });
});
