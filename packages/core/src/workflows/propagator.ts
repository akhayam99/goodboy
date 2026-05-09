import type { ContextSlot, IsoDateTime, StepTransition } from '@kay-am/types';
import { serializeSlots } from '../context';

export interface WorkflowPropagatorDeps {
  readonly summarizer: { summarizePhaseOutput(text: string): Promise<string> };
}

export class WorkflowPropagator {
  constructor(private readonly deps: WorkflowPropagatorDeps) {}
  async buildTransition(input: {
    fromOrdinal: number;
    toOrdinal: number;
    completedPhaseOutput: string;
    existingSlots: ReadonlyArray<ContextSlot>;
    at: IsoDateTime;
  }): Promise<StepTransition> {
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
