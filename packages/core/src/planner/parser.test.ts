import { describe, expect, it, vi } from 'vitest';
import { parsePlannerOutput, PlannerParseError } from './parser';
import { PLANNER_SYSTEM_PROMPT } from './prompt';

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

  it('turns a resolver step into an implementer step', () => {
    const raw = JSON.stringify({
      workflowName: 'Fix review',
      reasoning: 'One pass.',
      steps: [{ name: 'Fix findings', role: 'resolver', promptPrefix: 'x', expectedOutput: 'y' }],
    });
    expect(parsePlannerOutput(raw).steps[0]!.role).toBe('implementer');
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
    expect.assertions(2);
    try {
      parsePlannerOutput('not json');
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerParseError);
      expect((err as PlannerParseError).raw).toBe('not json');
    }
  });

  it('falls back to custom when role is not a canonical AgentRole', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const translated = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'implementatore', promptPrefix: 'p', expectedOutput: 'o' }],
    });
    const out = parsePlannerOutput(translated);
    expect(out.steps[0]!.role).toBe('custom');
    expect(warn).toHaveBeenCalledWith('[roles] unknown role "implementatore"; using custom');
    warn.mockRestore();
  });

  it('maps the non-canonical "other" role to custom', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const other = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'other', promptPrefix: 'p', expectedOutput: 'o' }],
    });
    const out = parsePlannerOutput(other);
    expect(out.steps[0]!.role).toBe('custom');
    expect(warn).toHaveBeenCalledWith('[roles] unknown role "other"; using custom');
    warn.mockRestore();
  });

  it('keeps the shipped wireframe role available', () => {
    const shipped = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'wireframe', promptPrefix: 'p', expectedOutput: 'o' }],
    });

    expect(parsePlannerOutput(shipped).steps[0]!.role).toBe('wireframe');
  });

  it('keeps the shipped report role available', () => {
    const shipped = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'report', promptPrefix: 'p', expectedOutput: 'o' }],
    });

    expect(parsePlannerOutput(shipped).steps[0]!.role).toBe('report');
  });

  it('advertises exactly the selection-eligible role vocabulary', () => {
    expect(PLANNER_SYSTEM_PROMPT).toContain(
      '"role": "<scout|investigator|planner|implementer|reviewer|tester|docs|report|wireframe|custom>"',
    );
  });

  it('normalizes a legacy role alias', () => {
    const legacy = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'Docs', role: 'writer', promptPrefix: 'p', expectedOutput: 'o' }],
    });

    expect(parsePlannerOutput(legacy).steps[0]!.role).toBe('docs');
  });

  it('preserves a canonical role verbatim', () => {
    const canonical = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [{ name: 'X', role: 'reviewer', promptPrefix: 'p', expectedOutput: 'o' }],
    });
    const out = parsePlannerOutput(canonical);
    expect(out.steps[0]!.role).toBe('reviewer');
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

  it('keeps a known planner size and drops anything else', () => {
    const sized = JSON.stringify({
      workflowName: 'X',
      reasoning: 'x',
      steps: [
        { name: 'A', role: 'scout', promptPrefix: 'p', expectedOutput: 'o', size: 'small' },
        { name: 'B', role: 'implementer', promptPrefix: 'p', expectedOutput: 'o', size: ' Large ' },
        { name: 'C', role: 'reviewer', promptPrefix: 'p', expectedOutput: 'o', size: '20 minutes' },
        { name: 'D', role: 'tester', promptPrefix: 'p', expectedOutput: 'o' },
      ],
    });

    expect(parsePlannerOutput(sized).steps.map((step) => step.size)).toEqual([
      'small',
      'large',
      null,
      null,
    ]);
  });

  it('asks for a relative size and never for a duration', () => {
    expect(PLANNER_SYSTEM_PROMPT).toContain('"size": "<small|medium|large>"');
    expect(PLANNER_SYSTEM_PROMPT).toContain('never a duration');
  });
});
