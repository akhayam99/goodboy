import { describe, expect, it } from 'vitest';
import { ROLE_REGISTRY } from '../roles';
import { BUILTIN_STEPS, builtinStepForRole, isBuiltinStepId } from './builtinSteps';

describe('BUILTIN_STEPS', () => {
  it('gives every built-in step its own id', () => {
    const ids = BUILTIN_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps one built-in step per role', () => {
    const roles = BUILTIN_STEPS.map((step) => step.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('only offers roles the picker lists, and never the blank custom role', () => {
    for (const step of BUILTIN_STEPS) {
      expect(ROLE_REGISTRY[step.role].pickerEligible).toBe(true);
      expect(step.role).not.toBe('custom');
    }
  });

  it('keeps the ids that saved workflows already point at', () => {
    for (const id of ['seed_scout', 'seed_planner', 'seed_implementer', 'seed_tester']) {
      expect(isBuiltinStepId({ id })).toBe(true);
    }
  });

  it('fills every field a step needs', () => {
    for (const step of BUILTIN_STEPS) {
      expect(step.name.trim()).not.toBe('');
      expect(step.promptPrefix.trim()).not.toBe('');
      expect(step.expectedOutput.trim()).not.toBe('');
    }
  });

  it('finds a built-in step by role and tells a workspace step apart', () => {
    expect(builtinStepForRole({ role: 'resolver' })?.id).toBe('seed_resolver');
    expect(builtinStepForRole({ role: 'custom' })).toBeUndefined();
    expect(isBuiltinStepId({ id: 'lib_step-1' })).toBe(false);
  });
});
