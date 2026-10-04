import type { ReactNode } from 'react';
import { ListChecks, PenLine } from 'lucide-react';
import { SegmentedTabs } from '@goodboy/ui';
import type { Mode } from '../../../../../store/slices/workflowDrafts/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly mode: Mode;
  readonly disabled: boolean;
  readonly control?: ReactNode;
  readonly onChange: (mode: Mode) => void;
};

const MODE_HINT: Record<Mode, string> = {
  dynamic: 'Goodboy picks each next agent after the previous one finishes.',
  custom: 'You set every step. Click a step to edit it.',
  preset: 'A saved sequence. Edit any step before starting.',
};

export const ModeSwitch = ({ mode, disabled, control = null, onChange }: Props) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedTabs
        ariaLabel="How the steps are set"
        size="sm"
        value={mode}
        onChange={onChange}
        options={[
          {
            value: 'dynamic',
            label: 'Orchestrated',
            icon: CONCEPT_ICONS.orchestrator,
            tooltip: 'Goodboy picks each next agent',
            disabled,
          },
          { value: 'custom', label: 'Describe steps', icon: PenLine, disabled },
          { value: 'preset', label: 'Pick a workflow', icon: ListChecks, disabled },
        ]}
      />
      {control}
    </div>
    <div className="text-secondary text-faint-foreground">{MODE_HINT[mode]}</div>
  </div>
);
