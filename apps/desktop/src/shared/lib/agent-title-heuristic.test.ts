import { describe, expect, it } from 'vitest';
import { heuristicAgentTitle } from './agent-title-heuristic';

describe('heuristicAgentTitle', () => {
  it('simple verb + nouns', () => {
    expect(heuristicAgentTitle('fix auth bug')).toBe('fix auth bug');
  });

  it('filters stop words after verb', () => {
    expect(heuristicAgentTitle('refactor the database layer')).toBe('refactor database layer');
  });

  it('verb not at position 0, skip prefix words', () => {
    expect(heuristicAgentTitle('please fix the broken router')).toBe('fix broken router');
  });

  it('"can you add …", finds verb past stop-word prefix', () => {
    expect(heuristicAgentTitle('can you add a dark mode toggle')).toBe('add dark mode');
  });

  it('caps at 3 significant words', () => {
    expect(heuristicAgentTitle('implement oauth2 provider adapter integration layer')).toBe(
      'implement oauth2 provider',
    );
  });

  it('verb with single content word returns 2-word title', () => {
    expect(heuristicAgentTitle('deploy production')).toBe('deploy production');
  });

  it('stop word between verb and noun is dropped', () => {
    expect(heuristicAgentTitle('deploy to production')).toBe('deploy production');
  });

  it('verb itself is always kept even if it looks like a stop word context', () => {
    expect(heuristicAgentTitle('migrate postgres schema')).toBe('migrate postgres schema');
  });

  it('strips code fences', () => {
    expect(heuristicAgentTitle('fix the bug in ```js\nconst x = 1\n``` module')).toBe(
      'fix bug module',
    );
  });

  it('strips inline backtick spans', () => {
    expect(heuristicAgentTitle('fix `broken.ts` imports')).toBe('fix imports');
  });

  it('strips URLs', () => {
    expect(heuristicAgentTitle('check https://example.com for docs')).toBe('check docs');
  });

  it('strips markdown bold markers', () => {
    expect(heuristicAgentTitle('**add** user authentication')).toBe('add user authentication');
  });

  it('strips heading markers', () => {
    expect(heuristicAgentTitle('# fix the auth service')).toBe('fix auth service');
  });

  it('fallback: 3 significant words when no verb', () => {
    expect(heuristicAgentTitle('authentication service performance')).toBe(
      'authentication service performance',
    );
  });

  it('fallback: filters stop words', () => {
    expect(heuristicAgentTitle('a broken auth flow')).toBe('broken auth flow');
  });

  it('fallback: "make" is stop-word not action-verb → stripped', () => {
    expect(heuristicAgentTitle('make auth flow better')).toBe('auth flow better');
  });

  it('fallback: "need" is stop-word → stripped, setup verb found but lone → falls to fallback', () => {
    expect(heuristicAgentTitle('need auth setup')).toBe('auth setup');
  });

  it('empty string → null', () => {
    expect(heuristicAgentTitle('')).toBeNull();
  });

  it('single action verb with no nouns → null', () => {
    expect(heuristicAgentTitle('fix')).toBeNull();
  });

  it('verb + stop-word noun only → null (significant.length < 2 in both paths)', () => {
    expect(heuristicAgentTitle('fix it')).toBeNull();
  });

  it('only stop words → null', () => {
    expect(heuristicAgentTitle('please help me')).toBeNull();
  });

  it('single non-verb significant word → null', () => {
    expect(heuristicAgentTitle('authentication')).toBeNull();
  });

  it('numbers-only multi-word → returned as-is via fallback', () => {
    expect(heuristicAgentTitle('123 456 789')).toBe('123 456 789');
  });

  it('single number → null', () => {
    expect(heuristicAgentTitle('42')).toBeNull();
  });

  it('mixed alpha-numeric: verb + number noun', () => {
    expect(heuristicAgentTitle('fix issue 42')).toBe('fix issue 42');
  });

  it('newlines collapsed: verb from later line is still found', () => {
    expect(heuristicAgentTitle('auth service\nfix the bug on line 42')).toBe('fix bug line');
  });

  it('newlines collapsed: all words contribute to verb slice', () => {
    expect(heuristicAgentTitle('fix auth\nand also update the UI')).toBe('fix auth also');
  });

  it('truncates to 300 chars, content beyond 300 ignored', () => {
    const padding = 'x'.repeat(290);
    const prompt = `optimize ${padding} important_stuff_after_limit`;
    const result = heuristicAgentTitle(prompt);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^optimize/);
    expect(result).not.toContain('important_stuff_after_limit');
  });

  it('result is at most 3 words', () => {
    const result = heuristicAgentTitle('implement authentication provider integration layer');
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
    expect(heuristicAgentTitle(prompt)).toBe(expected);
  });

  it('output is lowercase (input is lowercased internally)', () => {
    const result = heuristicAgentTitle('Fix The Auth Bug');
    expect(result).toBe('fix auth bug');
  });
});
