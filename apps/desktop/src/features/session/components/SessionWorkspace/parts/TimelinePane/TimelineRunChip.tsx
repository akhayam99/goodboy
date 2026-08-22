import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';

type Props = {
  readonly kind: RunWorkflowKind;
  readonly identity: RunIdentity;
  readonly muted?: boolean;
};

type KindGlyph = {
  readonly icon: LucideIcon;
  readonly label: string;
};

const KIND: Record<RunWorkflowKind, KindGlyph> = {
  preset: { icon: CONCEPT_ICONS.workflowPreset, label: 'Preset workflow' },
  custom: { icon: CONCEPT_ICONS.workflowCustom, label: 'Custom workflow' },
  orchestrator: { icon: CONCEPT_ICONS.orchestrator, label: 'Orchestrated workflow' },
};

const GLYPH_SIZE = 10;

export const TimelineRunChip = ({ kind, identity, muted = false }: Props) => {
  const { icon: Icon, label } = KIND[kind];
  return (
    <span
      className={cn(
        'inline-flex min-w-24 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide ring-1',
        muted ? identity.mutedChip : identity.chip,
      )}
      title={label}
    >
      <Icon size={GLYPH_SIZE} aria-label={label} />
      Workflow
    </span>
  );
};
