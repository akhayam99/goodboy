import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';

type RunKindGlyph = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly isNamedInTooltip: boolean;
};

export const RUN_KIND_GLYPH: Record<RunWorkflowKind, RunKindGlyph> = {
  preset: { icon: CONCEPT_ICONS.workflowPreset, label: 'Preset run', isNamedInTooltip: true },
  custom: { icon: CONCEPT_ICONS.workflowCustom, label: 'Custom run', isNamedInTooltip: true },
  orchestrator: {
    icon: CONCEPT_ICONS.orchestrator,
    label: 'Orchestrated run',
    isNamedInTooltip: false,
  },
};
