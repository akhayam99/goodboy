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

  it('returns null for a missing marker or invalid JSON', () => {
    expect(parseOrchestratorDecision('{"action":"done","reason":"done"}')).toBeNull();
    expect(parseOrchestratorDecision('<<orchestrator>>{bad}<</orchestrator>>')).toBeNull();
  });

  it('falls back to the custom role for an unknown role', () => {
    const parsed = parseOrchestratorDecision(
      '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"x","role":"writer","promptPrefix":"x","expectedOutput":"x"}}<</orchestrator>>',
    );

    expect(parsed).toEqual({
      action: 'next',
      reason: 'x',
      step: { name: 'x', role: 'custom', promptPrefix: 'x', expectedOutput: 'x' },
    });
  });

  it('tolerates a missing expected output and a missing reason', () => {
    const parsed = parseOrchestratorDecision(
      '<<orchestrator>>{"action":"next","step":{"name":"Fix it","role":"implementer","promptPrefix":"Fix the bug."}}<</orchestrator>>',
    );

    expect(parsed).toEqual({
      action: 'next',
      reason: '',
      step: { name: 'Fix it', role: 'implementer', promptPrefix: 'Fix the bug.' },
    });
  });

  it('tolerates code fences inside the marker', () => {
    const parsed = parseOrchestratorDecision(
      '<<orchestrator>>```json\n{"action":"done","reason":"All good."}\n```<</orchestrator>>',
    );

    expect(parsed).toEqual({ action: 'done', reason: 'All good.' });
  });

  it('tolerates a missing end marker', () => {
    const parsed = parseOrchestratorDecision(
      'Decision:\n<<orchestrator>>{"action":"done","reason":"Goal satisfied."}',
    );

    expect(parsed).toEqual({ action: 'done', reason: 'Goal satisfied.' });
  });

  it('repairs literal newlines inside JSON strings', () => {
    const parsed = parseOrchestratorDecision(
      '<<orchestrator>>{"action":"next","reason":"multi\nline","step":{"name":"Plan","role":"planner","promptPrefix":"Draft a plan:\n- item one\n- item two","expectedOutput":"a plan"}}<</orchestrator>>',
    );

    expect(parsed).toEqual({
      action: 'next',
      reason: 'multi\nline',
      step: {
        name: 'Plan',
        role: 'planner',
        promptPrefix: 'Draft a plan:\n- item one\n- item two',
        expectedOutput: 'a plan',
      },
    });
  });
});
