// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runKindLineOf } from './runKindLineOf';

describe('the kind line of a run row', () => {
  it('names the Lead of a new run', () => {
    expect(runKindLineOf({ line: { kind: 'lead', planName: null } })).toBe('Lead');
  });

  it('names the preset the Lead follows as its plan', () => {
    expect(runKindLineOf({ line: { kind: 'lead', planName: 'Fix flaky tests' } })).toBe(
      'Lead · plan Fix flaky tests',
    );
  });

  it('drops a blank plan name instead of a dangling word', () => {
    expect(runKindLineOf({ line: { kind: 'lead', planName: '  ' } })).toBe('Lead');
  });

  it('names a one agent run by its role, with no Lead', () => {
    expect(runKindLineOf({ line: { kind: 'agent', role: 'Implementer' } })).toBe(
      'Agent · Implementer',
    );
  });

  it('keeps the line of an older orchestrated or preset run', () => {
    expect(runKindLineOf({ line: { kind: 'orchestrated' } })).toBe('Workflow · Orchestrated');
    expect(runKindLineOf({ line: { kind: 'preset', presetName: 'Write the docs' } })).toBe(
      'Workflow · Preset Write the docs',
    );
  });
});
