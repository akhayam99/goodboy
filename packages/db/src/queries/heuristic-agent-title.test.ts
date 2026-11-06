// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { heuristicAgentTitle } from './heuristic-agent-title';

describe('heuristicAgentTitle', () => {
  it('keeps the words of the goal and capitalises the first letter', () => {
    expect(heuristicAgentTitle({ prompt: 'fix the ledger export' })).toBe('Fix the ledger export');
  });

  it('works in another language without dropping its words', () => {
    expect(heuristicAgentTitle({ prompt: 'Per favore aggiungi un pulsante di logout' })).toBe(
      'Per favore aggiungi un pulsante di logout',
    );
    expect(heuristicAgentTitle({ prompt: 'Scrivi i test per il modulo' })).toBe(
      'Scrivi i test per il modulo',
    );
  });

  it('stops at the first clause', () => {
    expect(heuristicAgentTitle({ prompt: 'Fix the flaky parser, then add tests.' })).toBe(
      'Fix the flaky parser',
    );
    expect(heuristicAgentTitle({ prompt: 'Speed up the export. It takes a minute.' })).toBe(
      'Speed up the export',
    );
  });

  it('keeps a dot inside a word', () => {
    expect(heuristicAgentTitle({ prompt: 'Bump payments-api to v1.2 today' })).toBe(
      'Bump payments-api to v1.2 today',
    );
  });

  it('stops at the first line', () => {
    expect(heuristicAgentTitle({ prompt: 'Add retry to notify-relay\nand log each try' })).toBe(
      'Add retry to notify-relay',
    );
  });

  it('caps at ten words', () => {
    expect(
      heuristicAgentTitle({ prompt: 'one two three four five six seven eight nine ten eleven' }),
    ).toBe('One two three four five six seven eight nine ten');
  });

  it('caps at sixty characters and cuts on a word', () => {
    const result = heuristicAgentTitle({
      prompt: 'internationalization infrastructure modernization authentication orchestration',
    });
    expect(result).toBe('Internationalization infrastructure modernization');
    expect(result?.length).toBeLessThanOrEqual(60);
  });

  it('cuts a single huge word at sixty characters', () => {
    expect(heuristicAgentTitle({ prompt: 'x'.repeat(100) })).toHaveLength(60);
  });

  it('strips code fences, inline code, urls and markdown marks', () => {
    expect(heuristicAgentTitle({ prompt: 'fix the bug in ```js\nconst x = 1\n``` module' })).toBe(
      'Fix the bug in module',
    );
    expect(heuristicAgentTitle({ prompt: 'fix `broken.ts` imports' })).toBe('Fix imports');
    expect(heuristicAgentTitle({ prompt: 'check https://example.com for docs' })).toBe(
      'Check for docs',
    );
    expect(heuristicAgentTitle({ prompt: '**add** user authentication' })).toBe(
      'Add user authentication',
    );
    expect(heuristicAgentTitle({ prompt: '# fix the auth service' })).toBe('Fix the auth service');
  });

  it('keeps a lone word', () => {
    expect(heuristicAgentTitle({ prompt: 'authentication' })).toBe('Authentication');
  });

  it('keeps the case of the rest of the goal', () => {
    expect(heuristicAgentTitle({ prompt: 'Fix The Auth Bug' })).toBe('Fix The Auth Bug');
  });

  it('returns null when nothing is left', () => {
    expect(heuristicAgentTitle({ prompt: '' })).toBeNull();
    expect(heuristicAgentTitle({ prompt: '   \n  ' })).toBeNull();
    expect(heuristicAgentTitle({ prompt: '`only code`' })).toBeNull();
  });
});
