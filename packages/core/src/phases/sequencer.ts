import type { PhaseDefinition, PhaseRun, PhaseTemplate } from '@kay-am/types';

export function nextPhase(
  template: PhaseTemplate,
  runs: ReadonlyArray<PhaseRun>,
): PhaseDefinition | null {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.phaseDefinitionId),
  );

  const sorted = [...template.definitions].sort((a, b) => a.ordinal - b.ordinal);
  return sorted.find((d) => !doneIds.has(d.id)) ?? null;
}

export function buildPhasePrompt(input: {
  definition: PhaseDefinition;
  carryForwardContext: string;
  userMessage: string;
}): string {
  const parts = [input.definition.promptPrefix, input.carryForwardContext, input.userMessage]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.join('\n\n');
}

export function isPhaseSequenceComplete(
  template: PhaseTemplate,
  runs: ReadonlyArray<PhaseRun>,
): boolean {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.phaseDefinitionId),
  );
  return template.definitions.every((d) => doneIds.has(d.id));
}
