import { describe, expect, it } from 'vitest';
import { parseOrchestratorDecision } from './parser';

describe('parseOrchestratorDecision', () => {
  it('parses a next decision surrounded by prose', () => {
    const raw =
      'Decision follows.\n<<orchestrator>>{"action":"next","reason":"Tests are missing","step":{"name":"Add tests","role":"tester","promptPrefix":"Test the behavior.","expectedOutput":"Passing focused tests."}}<</orchestrator>>\nDone.';

    expect(parseOrchestratorDecision({ raw, provider: 'anthropic' })).toEqual({
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
      parseOrchestratorDecision({
        raw: '<<orchestrator>>{"action":"done","reason":"The goal is satisfied."}<</orchestrator>>',
        provider: 'anthropic',
      }),
    ).toEqual({ action: 'done', reason: 'The goal is satisfied.' });
    expect(
      parseOrchestratorDecision({
        raw: '<<orchestrator>>{"action":"blocked","reason":"A decision is required."}<</orchestrator>>',
        provider: 'anthropic',
      }),
    ).toEqual({ action: 'blocked', reason: 'A decision is required.' });
  });

  it('returns null for a missing marker or invalid JSON', () => {
    expect(
      parseOrchestratorDecision({
        raw: '{"action":"done","reason":"done"}',
        provider: 'anthropic',
      }),
    ).toBeNull();
    expect(
      parseOrchestratorDecision({
        raw: '<<orchestrator>>{bad}<</orchestrator>>',
        provider: 'anthropic',
      }),
    ).toBeNull();
  });

  it('falls back to the custom role for an unknown role', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"x","role":"writer","promptPrefix":"x","expectedOutput":"x"}}<</orchestrator>>',
    });

    expect(parsed).toEqual({
      action: 'next',
      reason: 'x',
      step: { name: 'x', role: 'custom', promptPrefix: 'x', expectedOutput: 'x' },
    });
  });

  it('tolerates a missing expected output and a missing reason', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","step":{"name":"Fix it","role":"implementer","promptPrefix":"Fix the bug."}}<</orchestrator>>',
    });

    expect(parsed).toEqual({
      action: 'next',
      reason: '',
      step: { name: 'Fix it', role: 'implementer', promptPrefix: 'Fix the bug.' },
    });
  });

  it('keeps a model and effort the provider catalog supports', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"Plan","role":"planner","promptPrefix":"Draft a plan.","model":"opus-5","effort":"xhigh"}}<</orchestrator>>',
    });

    expect(parsed).toEqual({
      action: 'next',
      reason: 'x',
      step: {
        name: 'Plan',
        role: 'planner',
        promptPrefix: 'Draft a plan.',
        model: 'opus-5',
        effort: 'xhigh',
      },
    });
  });

  it('drops a model the provider does not offer', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"Plan","role":"planner","promptPrefix":"Draft a plan.","model":"gpt-5.6"}}<</orchestrator>>',
    });

    expect(parsed).toEqual({
      action: 'next',
      reason: 'x',
      step: { name: 'Plan', role: 'planner', promptPrefix: 'Draft a plan.' },
    });
  });

  it('drops an effort outside the ladder of the chosen model', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"Fix","role":"implementer","promptPrefix":"Fix it.","model":"sonnet-5","effort":"max"}}<</orchestrator>>',
    });

    expect(parsed).toEqual({
      action: 'next',
      reason: 'x',
      step: { name: 'Fix', role: 'implementer', promptPrefix: 'Fix it.', model: 'sonnet-5' },
    });
  });

  it('tolerates code fences inside the marker', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>```json\n{"action":"done","reason":"All good."}\n```<</orchestrator>>',
    });

    expect(parsed).toEqual({ action: 'done', reason: 'All good.' });
  });

  it('tolerates a missing end marker', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: 'Decision:\n<<orchestrator>>{"action":"done","reason":"Goal satisfied."}',
    });

    expect(parsed).toEqual({ action: 'done', reason: 'Goal satisfied.' });
  });

  it('stops the missing-end-marker fallback before a recap that carries a brace', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"done","reason":"Goal satisfied."}\n<<run-summary>>\n**Done**\n- closed the `}` case\n<</run-summary>>',
    });

    expect(parsed).toEqual({
      action: 'done',
      reason: 'Goal satisfied.',
      runSummary: '**Done**\n- closed the `}` case',
    });
  });

  it('repairs literal newlines inside JSON strings', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"next","reason":"multi\nline","step":{"name":"Plan","role":"planner","promptPrefix":"Draft a plan:\n- item one\n- item two","expectedOutput":"a plan"}}<</orchestrator>>',
    });

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
  it('carries the run recap that travels alongside the decision', () => {
    const parsed = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"done","reason":"Goal satisfied."}<</orchestrator>>\n<<run-summary>>\n**Done**\n- shipped the gate\n\n**Left**\n- nothing\n<</run-summary>>',
    });

    expect(parsed).toEqual({
      action: 'done',
      reason: 'Goal satisfied.',
      runSummary: '**Done**\n- shipped the gate\n\n**Left**\n- nothing',
    });
  });

  it('leaves the recap out when the block is missing or empty', () => {
    const missing = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"done","reason":"Goal satisfied."}<</orchestrator>>',
    });
    const empty = parseOrchestratorDecision({
      provider: 'anthropic',
      raw: '<<orchestrator>>{"action":"done","reason":"Goal satisfied."}<</orchestrator>><<run-summary>>   <</run-summary>>',
    });

    expect(missing).not.toHaveProperty('runSummary');
    expect(empty).not.toHaveProperty('runSummary');
  });
});
