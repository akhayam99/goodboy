import type { LucideIcon } from 'lucide-react';
import type { WorkflowOrigin } from '@goodboy/types';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const LABEL: Record<WorkflowOrigin, string> = {
  library: 'Preset, shipped with Goodboy',
  custom: 'Custom, built step by step',
  orchestrated: 'Orchestrated, steps decided at runtime',
};

const ICON: Record<WorkflowOrigin, LucideIcon> = {
  library: CONCEPT_ICONS.workflowPreset,
  custom: CONCEPT_ICONS.rename,
  orchestrated: CONCEPT_ICONS.orchestrator,
};

const TONE: Record<WorkflowOrigin, Tone> = {
  library: 'neutral',
  custom: 'neutral',
  orchestrated: 'primary',
};

type Props = {
  readonly origin: WorkflowOrigin;
};

export const WorkflowOriginTag = ({ origin }: Props) => {
  const Icon = ICON[origin];
  return (
    <Tooltip content={LABEL[origin]}>
      <span role="img" aria-label={LABEL[origin]} className="inline-flex shrink-0">
        <Icon size={ICON_SIZE.row} aria-hidden className={cn(tintClasses(TONE[origin]).icon)} />
      </span>
    </Tooltip>
  );
};
