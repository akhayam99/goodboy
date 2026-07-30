import { describe, expect, it } from 'vitest';
import { parseOrchestratorDecision } from './parser';

describe('parseOrchestratorDecision', () => {
  it('parses a next decision surrounded by prose', () => {
    const raw =
      'Decision follows.\n<<orchestrator>>{"action":"next","reason":"Tests are missing","step":{"name":"Add tests","role":"tester","promptPrefix":"Test the behavior.","expectedOutput":"Passing focused tests."}}<</orchestrator>>\nDone.';

    expect(parseOrchestratorDecision(raw)).toEqual({
      action: 'next',
      reason: 'Tests are missing',
      step: {
        name: 'Add tests',
        role: 'tester',
        promptPrefix: 'Test the behavior.',
        expectedOutput: 'Passing focused tests.',
      },
    });
  });

  it('parses terminal decisions', () => {
    expect(
      parseOrchestratorDecision(
        '<<orchestrator>>{"action":"done","reason":"The goal is satisfied."}<</orchestrator>>',
      ),
    ).toEqual({ action: 'done', reason: 'The goal is satisfied.' });
    expect(
      parseOrchestratorDecision(
        '<<orchestrator>>{"action":"blocked","reason":"A decision is required."}<</orchestrator>>',
      ),
    ).toEqual({ action: 'blocked', reason: 'A decision is required.' });
  });

  it('returns null for a missing marker, invalid JSON, or invalid role', () => {
    expect(parseOrchestratorDecision('{"action":"done","reason":"done"}')).toBeNull();
    expect(parseOrchestratorDecision('<<orchestrator>>{bad}<</orchestrator>>')).toBeNull();
    expect(
      parseOrchestratorDecision(
        '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"x","role":"writer","promptPrefix":"x","expectedOutput":"x"}}<</orchestrator>>',
      ),
    ).toBeNull();
  });
});
