import { describe, expect, it } from 'vitest';
import * as core from '@kay-am/core';
import * as phases from './index';

describe('phases barrel exports', () => {
  it('exposes browser-safe sequencer and propagator from @kay-am/core root', () => {
    expect(core.nextPhase).toBeTypeOf('function');
    expect(core.buildPhasePrompt).toBeTypeOf('function');
    expect(core.isPhaseSequenceComplete).toBeTypeOf('function');
    expect(core.PhaseContextPropagator).toBeTypeOf('function');
  });

  it('exposes the same symbols from the phases sub-barrel', () => {
    expect(phases.nextPhase).toBeTypeOf('function');
    expect(phases.buildPhasePrompt).toBeTypeOf('function');
    expect(phases.isPhaseSequenceComplete).toBeTypeOf('function');
    expect(phases.PhaseContextPropagator).toBeTypeOf('function');
  });

  it('does NOT expose PhaseRegistry from the root @kay-am/core barrel (node-only)', () => {
    expect((core as Record<string, unknown>).PhaseRegistry).toBeUndefined();
    expect((phases as Record<string, unknown>).PhaseRegistry).toBeUndefined();
  });
});
