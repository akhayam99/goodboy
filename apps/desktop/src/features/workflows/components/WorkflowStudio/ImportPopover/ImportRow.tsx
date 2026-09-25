import { Checkbox } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { classifyStep } from '../../../../session/agent-kind';
import { AgentKindChip } from '../../../../session/components/AgentKindChip';

type Props = {
  readonly workflow: Workflow;
  readonly isSelected: boolean;
  readonly isNameTaken: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
};

const MAX_ROLE_CHIPS = 6;

export const ImportRow = ({ workflow, isSelected, isNameTaken, disabled, onToggle }: Props) => {
  const steps = [...workflow.steps].sort((left, right) => left.ordinal - right.ordinal);
  const count = steps.length;
  return (
    <li className="flex min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1 transition-colors hover:bg-hover">
      <div className="flex min-w-0 items-center gap-2">
        <Checkbox
          checked={isSelected}
          disabled={disabled}
          onChange={onToggle}
          className="min-w-0 flex-1"
          label={<span className="truncate text-xs text-foreground">{workflow.name}</span>}
        />
        {isNameTaken ? (
          <span className="shrink-0 text-2xs text-faint-foreground">Same name here</span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-2 pl-5.5" aria-hidden>
        <span className="flex items-center gap-1">
          {steps.slice(0, MAX_ROLE_CHIPS).map((step) => (
            <AgentKindChip
              key={step.id}
              kind={classifyStep({ step })}
              density="glyph"
              title={step.name}
            />
          ))}
        </span>
        <span className="text-2xs tabular-nums text-faint-foreground">
          {`${count} ${count === 1 ? 'step' : 'steps'}`}
        </span>
      </div>
    </li>
  );
};
