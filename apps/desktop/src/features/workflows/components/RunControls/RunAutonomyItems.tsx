import { Check } from 'lucide-react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly onChange: (autonomy: WorkflowAutonomy) => void;
};

export const RunAutonomyItems = ({ autonomy, onChange }: Props) => (
  <div role="group" aria-label={RUN_AUTONOMY_HEADER} className="flex flex-col">
    <div className="px-2.5 pb-0.5 pt-1.5 text-eyebrow text-faint-foreground">
      {RUN_AUTONOMY_HEADER}
    </div>
    {RUN_AUTONOMY_OPTIONS.map((option) => {
      const isChecked = option.key === autonomy;
      return (
        <button
          key={option.key}
          type="button"
          role="menuitemradio"
          aria-checked={isChecked}
          title={option.hint}
          onClick={() => onChange(option.key)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
        >
          <span className="flex w-3 shrink-0 justify-center">
            {isChecked ? <Check size={ICON_SIZE.row} aria-hidden className="text-primary" /> : null}
          </span>
          <span className="flex-1 truncate">{option.label}</span>
        </button>
      );
    })}
  </div>
);
