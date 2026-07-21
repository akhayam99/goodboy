import type { ContextSlot, IsoDateTime, StepTransition } from '@goodboy/types';

const EARLIER_STEP_PREVIEW_LENGTH = 280;
const NO_OUTPUT = '(no output captured)';

export type ChainCarryForwardStep = {
  readonly ordinal?: number | null;
  readonly name?: string | null;
  readonly outputSummary?: string | null;
};

type Params = {
  readonly steps?: ReadonlyArray<ChainCarryForwardStep | null | undefined> | null;
};

export const buildChainCarryForward = ({ steps }: Params): string => {
  const orderedSteps = (steps ?? [])
    .filter((step): step is ChainCarryForwardStep => step != null)
    .map((step) => ({
      ordinal: typeof step.ordinal === 'number' && Number.isFinite(step.ordinal) ? step.ordinal : 0,
      name: typeof step.name === 'string' ? step.name.trim() : '',
      outputSummary: typeof step.outputSummary === 'string' ? step.outputSummary : '',
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  const immediateStep = orderedSteps.at(-1);
  if (immediateStep == null) {
    return '';
  }

  const immediateSummary = immediateStep.outputSummary.trim();
  const lines = [
    '## workflow handoff',
    `### step ${immediateStep.ordinal} output: ${immediateStep.name}`,
    immediateSummary.length > 0 ? immediateSummary : NO_OUTPUT,
  ];
  if (orderedSteps.length === 1) {
    return lines.join('\n');
  }

  lines.push('### earlier steps');
  const earlierSteps = orderedSteps.slice(0, -1).reverse();
  earlierSteps.forEach((step, index) => {
    const summary = step.outputSummary.trim();
    if (summary.length === 0) {
      lines.push(`- step ${step.ordinal} ${step.name}: ${NO_OUTPUT}`);
      return;
    }
    const preview =
      index === 0 ? summary.slice(0, EARLIER_STEP_PREVIEW_LENGTH) : summary.split(/\r?\n/, 1)[0];
    lines.push(`- step ${step.ordinal} ${step.name}: ${preview ?? ''}`);
  });
  return lines.join('\n');
};

export type WorkflowPropagatorDeps = {
  readonly summarizer: { summarizePhaseOutput(text: string): Promise<string> };
};

type LegacyTransitionInput = {
  readonly fromOrdinal: number;
  readonly toOrdinal: number;
  readonly completedPhaseOutput: string;
  readonly existingSlots: ReadonlyArray<ContextSlot>;
  readonly at: IsoDateTime;
};

export class WorkflowPropagator {
  constructor(_deps?: WorkflowPropagatorDeps) {}

  buildChainCarryForward({ steps }: Params): string {
    return buildChainCarryForward({ steps });
  }

  buildTransition({
    fromOrdinal,
    toOrdinal,
    completedPhaseOutput,
    at,
  }: LegacyTransitionInput): Promise<StepTransition> {
    return Promise.resolve({
      fromOrdinal,
      toOrdinal,
      carryForwardContext: buildChainCarryForward({
        steps: [{ ordinal: fromOrdinal, name: '', outputSummary: completedPhaseOutput }],
      }),
      at,
    });
  }
}
