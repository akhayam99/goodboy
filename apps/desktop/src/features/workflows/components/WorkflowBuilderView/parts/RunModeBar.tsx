import type { ReactNode } from 'react';
import { ListChecks } from 'lucide-react';
import { SegmentedTabs } from '@goodboy/ui';
import type { Mode } from '../../../../../store/slices/workflowDrafts/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly mode: Mode;
  readonly isDisabled: boolean;
  readonly control?: ReactNode;
  readonly description: string;
  readonly onChange: (mode: Mode) => void;
};

export const RunModeBar = ({ mode, isDisabled, control = null, description, onChange }: Props) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedTabs
        ariaLabel="How the steps are set"
        size="sm"
        value={mode}
        onChange={onChange}
        options={[
          {
            value: 'dynamic',
            label: 'Orchestrate',
            icon: CONCEPT_ICONS.orchestrator,
            tooltip: 'Goodboy picks each next agent',
            disabled: isDisabled,
          },
          { value: 'preset', label: 'Preset', icon: ListChecks, disabled: isDisabled },
        ]}
      />
      {control}
    </div>
    <p className="text-label text-muted-foreground">{description}</p>
  </div>
);
