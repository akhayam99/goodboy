import { describe, expect, it } from 'vitest';
import { classifyFirstTurn, type FirstTurnClassification } from './first-turn-classifier';

describe('classifyFirstTurn', () => {
  it.each<[string, FirstTurnClassification]>([
    ['find where user auth is defined', 'scout'],
    ['look for the parser', 'scout'],
    ['explore the codebase', 'scout'],
    ['grep for AGENT_KIND_PALETTE', 'scout'],
    ['where is the store?', 'scout'],
    ['locate the spawn path', 'scout'],
    ['survey the providers package', 'scout'],
  ])('scout: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['plan the new feature flow', 'plan'],
    ['design the API surface', 'plan'],
    ['propose an approach', 'plan'],
    ['outline a roadmap', 'plan'],
    ['draft a spec', 'plan'],
  ])('plan: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['implement the chip auto-label', 'implement'],
    ['build a settings dialog', 'implement'],
    ['refactor the reducer', 'implement'],
    ['rename selectAgent to pickAgent', 'implement'],
    ['migrate the schema', 'implement'],
  ])('implement: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['review the diff', 'review'],
    ['audit the permission engine', 'review'],
    ['inspect the new tests', 'review'],
  ])('review: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['write tests for the classifier', 'test'],
    ['add tests for the store reducer', 'test'],
    ['test coverage for budget alerts', 'test'],
  ])('test: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['write docs for the provider adapter', 'docs'],
    ['update the readme', 'docs'],
    ['draft the changelog', 'docs'],
  ])('docs: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it.each<[string, FirstTurnClassification]>([
    ['debug the crash on startup', 'debug'],
    ['reproduce the test failure', 'debug'],
    ['why is the chip blank?', 'debug'],
    ['find the root cause of the regression', 'debug'],
    ['the app is broken on macOS', 'debug'],
  ])('debug: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected);
  });

  it('returns unknown on empty input', () => {
    expect(classifyFirstTurn('')).toBe('unknown');
    expect(classifyFirstTurn('   \n')).toBe('unknown');
  });

  it('returns unknown when no category matches', () => {
    expect(classifyFirstTurn('hello')).toBe('unknown');
    expect(classifyFirstTurn('thanks!')).toBe('unknown');
    expect(classifyFirstTurn('continue')).toBe('unknown');
  });

  it('returns unknown when multiple categories match (conservative)', () => {
    expect(classifyFirstTurn('plan and implement the migration')).toBe('unknown');
    expect(classifyFirstTurn('debug and fix the test failure')).toBe('unknown');
    expect(classifyFirstTurn('explore and refactor the store')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(classifyFirstTurn('FIND the bug')).toBe('scout');
    expect(classifyFirstTurn('Review THIS')).toBe('review');
  });

  it('does not match substrings inside words', () => {
    expect(classifyFirstTurn('preplanned')).toBe('unknown');
    expect(classifyFirstTurn('refundable')).toBe('unknown');
  });

  it('"write tests" does not collide with implement (write*)', () => {
    expect(classifyFirstTurn('write tests for the parser')).toBe('test');
  });

  it('"write docs" does not collide with implement (write*)', () => {
    expect(classifyFirstTurn('write docs for the api')).toBe('docs');
  });
});
