import type { LucideIcon } from 'lucide-react';
import { WORK_ROW, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';

type Props = {
  readonly kind: RunWorkflowKind;
  readonly workflowName: string;
  readonly identity: RunIdentity;
  readonly muted?: boolean;
  readonly lit?: boolean;
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

export const TimelineRunChip = ({
  kind,
  workflowName,
  identity,
  muted = false,
  lit = false,
}: Props) => {
  const { icon: Icon, label, isNamedInTooltip } = KIND[kind];
  const name = workflowName.trim();
  const tooltip = isNamedInTooltip && name.length > 0 ? `${name} ${label.toLowerCase()}` : label;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium leading-none ring-1 ring-inset motion-safe:transition-colors',
        WORK_ROW.chipBox,
        lit ? identity.litChip : muted ? identity.mutedChip : identity.chip,
      )}
      title={tooltip}
    >
      <Icon size={GLYPH_SIZE} aria-label={label} />
      <span className={WORK_ROW.chipLabel}>Workflow</span>
    </span>
  );
};
