import type { ContextSlot, IsoDateTime, PhaseTransition } from '@kay-am/types';
import { serializeSlots } from '../context';

export interface PhaseContextPropagatorDeps {
  readonly summarizer: { summarizePhaseOutput(text: string): Promise<string> };
}

export class PhaseContextPropagator {
  constructor(private readonly deps: PhaseContextPropagatorDeps) {}
  async buildTransition(input: {
    fromOrdinal: number;
    toOrdinal: number;
    completedPhaseOutput: string;
    existingSlots: ReadonlyArray<ContextSlot>;
    at: IsoDateTime;
  }): Promise<PhaseTransition> {
    const summary = await this.deps.summarizer.summarizePhaseOutput(input.completedPhaseOutput);
    const slotsText = serializeSlots(input.existingSlots);
    const carryForwardContext = [summary, slotsText]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    return {
      fromOrdinal: input.fromOrdinal,
      toOrdinal: input.toOrdinal,
      carryForwardContext,
      at: input.at,
    };
  }
}
