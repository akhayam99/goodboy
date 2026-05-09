import { describe, expect, it } from 'vitest';
import * as core from '@kay-am/core';
import * as phases from './index';

describe('phases barrel exports', () => {
  it('exposes browser-safe sequencer and propagator from @kay-am/core root', () => {
    expect(core.nextStep).toBeTypeOf('function');
    expect(core.buildStepPrompt).toBeTypeOf('function');
    expect(core.isWorkflowComplete).toBeTypeOf('function');
    expect(core.WorkflowPropagator).toBeTypeOf('function');
  });

  it('exposes the same symbols from the phases sub-barrel', () => {
    expect(phases.nextStep).toBeTypeOf('function');
    expect(phases.buildStepPrompt).toBeTypeOf('function');
    expect(phases.isWorkflowComplete).toBeTypeOf('function');
    expect(phases.WorkflowPropagator).toBeTypeOf('function');
  });

  it('does NOT expose WorkflowRegistry from the root @kay-am/core barrel (node-only)', () => {
    expect((core as Record<string, unknown>).WorkflowRegistry).toBeUndefined();
    expect((phases as Record<string, unknown>).WorkflowRegistry).toBeUndefined();
  });
});
