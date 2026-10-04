import type { LucideIcon } from 'lucide-react';
import { Chip, WORK_ROW, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';

type Props = {
  readonly kind: RunWorkflowKind;
  readonly workflowName: string;
  readonly muted?: boolean;
};

type KindGlyph = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly isNamedInTooltip: boolean;
};

const KIND: Record<RunWorkflowKind, KindGlyph> = {
  preset: { icon: CONCEPT_ICONS.workflowPreset, label: 'Preset workflow', isNamedInTooltip: true },
  custom: { icon: CONCEPT_ICONS.workflowCustom, label: 'Custom workflow', isNamedInTooltip: true },
  orchestrator: {
    icon: CONCEPT_ICONS.orchestrator,
    label: 'Orchestrated workflow',
    isNamedInTooltip: false,
  },
};

const GLYPH_SIZE = 10;

const CHIP_TONE = {
  rest: '',
  muted: 'bg-transparent text-faint-foreground',
} as const;

export const TimelineRunChip = ({ kind, workflowName, muted = false }: Props) => {
  const { icon: Icon, label, isNamedInTooltip } = KIND[kind];
  const name = workflowName.trim();
  const tooltip = isNamedInTooltip && name.length > 0 ? `${name} ${label.toLowerCase()}` : label;
  return (
    <Chip
      tone="neutral"
      size="3xs"
      title={tooltip}
      icon={<Icon size={GLYPH_SIZE} aria-label={label} />}
      label={<span className={WORK_ROW.chipLabel}>Workflow</span>}
      className={cn(
        'shrink-0 justify-center motion-safe:transition-colors',
        muted ? CHIP_TONE.muted : CHIP_TONE.rest,
      )}
    />
  );
};
