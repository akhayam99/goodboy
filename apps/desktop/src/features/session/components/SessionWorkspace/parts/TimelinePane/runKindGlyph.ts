import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { activityRowConcept } from '../../../../timeline/activityRowConcept';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';

type RunKindGlyph = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly isNamedInTooltip: boolean;
};

const WORKFLOW_RUN_ICON = CONCEPT_ICONS[activityRowConcept({ kind: 'workflow-run' })];

export const RUN_KIND_GLYPH: Record<RunWorkflowKind, RunKindGlyph> = {
  preset: { icon: WORKFLOW_RUN_ICON, label: 'Preset run', isNamedInTooltip: true },
  custom: { icon: WORKFLOW_RUN_ICON, label: 'Custom run', isNamedInTooltip: true },
  orchestrator: {
    icon: CONCEPT_ICONS[activityRowConcept({ kind: 'orchestrated-run' })],
    label: 'Orchestrated run',
    isNamedInTooltip: false,
  },
};
