// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentRole } from '@goodboy/types';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import type { SavedStep } from '../../../savedSteps';
import { isRoleRepeated } from './isRoleRepeated';

type StepParams = {
  readonly role: AgentRole;
  readonly name: string;
};

const stepOf = ({ role, name }: StepParams): SavedStep => ({
  id: JSON.parse('"step-1"'),
  role,
  name,
  promptPrefix: '',
  expectedOutput: '',
  isBuiltin: true,
  baseStepId: null,
  providerDefault: null,
  modelDefault: null,
  effortDefault: null,
  verbosityDefault: null,
});

describe('isRoleRepeated', () => {
  it('is true when the step is named after its role', () => {
    expect(isRoleRepeated({ step: stepOf({ role: 'scout', name: ROLE_LABEL.scout }) })).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    const name = `  ${ROLE_LABEL.scout.toUpperCase()} `;

    expect(isRoleRepeated({ step: stepOf({ role: 'scout', name }) })).toBe(true);
  });

  it('is false for a step with its own name', () => {
    expect(isRoleRepeated({ step: stepOf({ role: 'scout', name: 'Map payments-api' }) })).toBe(
      false,
    );
  });
});
