import { describe, expect, it } from 'vitest';
import { isWorkflowKickoff, parseWorkflowKickoff } from './parse-workflow-kickoff';

const marker =
  '**Scope** this step only, never a later one. Emit `<<step-done id="agent-1">>` on its own line once it is truly done.';

const withPlan = [
  '**Goal** Ship the onboarding wizard',
  '**Plan**\n1. wire steps\n2. add tests',
  'Focus on the providers step only.',
  marker,
].join('\n\n');

const withoutPlan = [
  '**Goal** Ship the onboarding wizard',
  'Focus on the providers step only.',
  marker,
].join('\n\n');

describe('isWorkflowKickoff', () => {
  it('is true for a composed kickoff', () => {
    expect(isWorkflowKickoff(withPlan)).toBe(true);
    expect(isWorkflowKickoff(withoutPlan)).toBe(true);
  });

  it('is false for a plain user message', () => {
    expect(isWorkflowKickoff('can you fix the login bug?')).toBe(false);
  });

  it('is false when only one anchor is present', () => {
    expect(isWorkflowKickoff('**Goal** do a thing')).toBe(false);
    expect(isWorkflowKickoff('**Scope** this step only now')).toBe(false);
  });
});

describe('parseWorkflowKickoff', () => {
  it('splits goal, instructions (incl. plan) and marker when a plan is present', () => {
    const parsed = parseWorkflowKickoff(withPlan);
    expect(parsed.parsed).toBe(true);
    expect(parsed.goal).toBe('Ship the onboarding wizard');
    expect(parsed.instructions).toContain('**Plan**');
    expect(parsed.instructions).toContain('Focus on the providers step only.');
    expect(parsed.marker.startsWith('**Scope** this step only')).toBe(true);
  });

  it('splits on the first paragraph when no plan is present', () => {
    const parsed = parseWorkflowKickoff(withoutPlan);
    expect(parsed.parsed).toBe(true);
    expect(parsed.goal).toBe('Ship the onboarding wizard');
    expect(parsed.instructions).toBe('Focus on the providers step only.');
  });

  it('keeps only the first paragraph as goal for a multi-paragraph goal', () => {
    const text = ['**Goal** Main objective', 'Secondary detail paragraph', marker].join('\n\n');
    const parsed = parseWorkflowKickoff(text);
    expect(parsed.parsed).toBe(true);
    expect(parsed.goal).toBe('Main objective');
    expect(parsed.instructions).toBe('Secondary detail paragraph');
  });

  it('returns parsed:false for non-kickoff text', () => {
    const parsed = parseWorkflowKickoff('just a normal message');
    expect(parsed.parsed).toBe(false);
    expect(parsed.goal).toBe('');
    expect(parsed.marker).toBe('');
  });

  it('returns parsed:false when the goal body is empty', () => {
    const malformed = `**Goal**\n\n\n\n${marker}`;
    const parsed = parseWorkflowKickoff(malformed);
    expect(parsed.parsed).toBe(false);
  });

  it('returns parsed:false when the goal is only whitespace', () => {
    const malformed = `**Goal**\n\n   \n\n${marker}`;
    const parsed = parseWorkflowKickoff(malformed);
    expect(parsed.parsed).toBe(false);
    expect(parsed.goal).toBe('');
  });

  it('still captures the marker on a parsed:false empty-goal result', () => {
    const malformed = `**Goal**\n\n\n\n${marker}`;
    const parsed = parseWorkflowKickoff(malformed);
    expect(parsed.parsed).toBe(false);
    expect(parsed.marker).toContain('**Scope** this step only');
  });

  it('handles no paragraph break — goal is the whole body, instructions empty', () => {
    const text = `**Goal** Single line goal with no break\n\n${marker}`;
    const parsed = parseWorkflowKickoff(text);
    expect(parsed.parsed).toBe(true);
    expect(parsed.goal).toBe('Single line goal with no break');
    expect(parsed.instructions).toBe('');
  });

  it('returns all four fields on a successful parse', () => {
    const parsed = parseWorkflowKickoff(withPlan);
    expect(typeof parsed.goal).toBe('string');
    expect(typeof parsed.instructions).toBe('string');
    expect(typeof parsed.marker).toBe('string');
    expect(parsed.parsed).toBe(true);
  });

  it('marker contains the full step-done instruction block', () => {
    const parsed = parseWorkflowKickoff(withPlan);
    expect(parsed.marker).toContain('**Scope** this step only');
    expect(parsed.marker).toContain('<<step-done id="agent-1">>');
  });

  it('instructions include plan body when plan is present', () => {
    const parsed = parseWorkflowKickoff(withPlan);
    expect(parsed.instructions).toContain('1. wire steps');
    expect(parsed.instructions).toContain('2. add tests');
  });

  it('is deterministic — same input produces same output on repeated calls', () => {
    const a = parseWorkflowKickoff(withPlan);
    const b = parseWorkflowKickoff(withPlan);
    expect(a).toEqual(b);
  });
});
