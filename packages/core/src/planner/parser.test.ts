import { describe, expect, it } from 'vitest';
import { parsePlannerOutput, PlannerParseError } from './parser';

const validJson = JSON.stringify({
  workflowName: 'Auth Refactor',
  reasoning: 'Two passes: scout the existing auth, then refactor in place.',
  steps: [
    {
      name: 'Scout',
      role: 'scout',
      promptPrefix: 'Survey auth-related files.',
      expectedOutput: 'A map of auth modules.',
    },
    {
      name: 'Refactor',
      role: 'implementer',
      promptPrefix: 'Apply the refactor in small commits.',
      expectedOutput: 'A diff with updated tests.',
    },
  ],
});

describe('parsePlannerOutput', () => {
  it('parses a well-formed planner response', () => {
    const out = parsePlannerOutput(validJson);
    expect(out.workflowName).toBe('Auth Refactor');
    expect(out.steps).toHaveLength(2);
    expect(out.steps[0]!.name).toBe('Scout');
    expect(out.steps[1]!.role).toBe('implementer');
  });

  it('strips json code fences', () => {
    const fenced = '```json\n' + validJson + '\n```';
    const out = parsePlannerOutput(fenced);
    expect(out.workflowName).toBe('Auth Refactor');
  });

  it('strips bare code fences', () => {
    const fenced = '```\n' + validJson + '\n```';
    const out = parsePlannerOutput(fenced);
    expect(out.steps).toHaveLength(2);
  });

  it('strips fences with whitespace padding around the payload', () => {
    const fenced = '```json\n\t ' + validJson + ' \t\n\t ```';
    const out = parsePlannerOutput(fenced);
    expect(out.workflowName).toBe('Auth Refactor');
  });

  it('rejects invalid json', () => {
    expect(() => parsePlannerOutput('{not json')).toThrow(PlannerParseError);
  });

  it('rejects missing workflowName', () => {
    const bad = JSON.stringify({ reasoning: 'x', steps: [] });
    expect(() => parsePlannerOutput(bad)).toThrow(/workflowName/);
  });

  it('rejects empty workflowName', () => {
    const bad = JSON.stringify({ workflowName: '   ', reasoning: 'x', steps: [] });
    expect(() => parsePlannerOutput(bad)).toThrow(/workflowName/);
  });

  it('rejects missing reasoning', () => {
    const bad = JSON.stringify({ workflowName: 'X', steps: [] });
    expect(() => parsePlannerOutput(bad)).toThrow(/reasoning/);
  });

  it('rejects non-array steps', () => {
    const bad = JSON.stringify({ workflowName: 'X', reasoning: 'x', steps: 'nope' });
    expect(() => parsePlannerOutput(bad)).toThrow(/steps/);
  });

  it('rejects empty steps', () => {
    const bad = JSON.stringify({ workflowName: 'X', reasoning: 'x', steps: [] });
    expect(() => parsePlannerOutput(bad)).toThrow(/at least one step/);
  });

  it('rejects step missing name', () => {
    const bad = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ role: 'scout', promptPrefix: '', expectedOutput: '' }],
    });
    expect(() => parsePlannerOutput(bad)).toThrow(/name/);
  });

  it('rejects step missing role', () => {
    const bad = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', promptPrefix: '', expectedOutput: '' }],
    });
    expect(() => parsePlannerOutput(bad)).toThrow(/role/);
  });

  it('rejects step missing promptPrefix', () => {
    const bad = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'scout', expectedOutput: '' }],
    });
    expect(() => parsePlannerOutput(bad)).toThrow(/promptPrefix/);
  });

  it('rejects step missing expectedOutput', () => {
    const bad = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'scout', promptPrefix: '' }],
    });
    expect(() => parsePlannerOutput(bad)).toThrow(/expectedOutput/);
  });

  it('extracts JSON from surrounding prose', () => {
    const wrapped = `Here is the workflow plan:\n${validJson}\nHope this helps!`;
    const out = parsePlannerOutput(wrapped);
    expect(out.workflowName).toBe('Auth Refactor');
    expect(out.steps).toHaveLength(2);
  });

  it('gives clear error when model returns plain text', () => {
    expect(() => parsePlannerOutput('non posso generare un workflow')).toThrow(
      /plain text instead of JSON/,
    );
  });

  it('exposes the raw input on error', () => {
    try {
      parsePlannerOutput('not json');
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerParseError);
      expect((err as PlannerParseError).raw).toBe('not json');
    }
  });

  it('trims whitespace from workflowName', () => {
    const padded = JSON.stringify({
      workflowName: '  Auth  ',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'scout', promptPrefix: 'p', expectedOutput: 'o' }],
    });
    const out = parsePlannerOutput(padded);
    expect(out.workflowName).toBe('Auth');
  });
});
