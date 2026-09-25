import { Check } from 'lucide-react';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import type { Workflow, WorkflowRunId, WorkflowTriggerMode } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ControlChip } from './ControlChip';

export type ChainRun = {
  readonly run: { readonly id: WorkflowRunId; readonly title?: string };
  readonly template: Workflow;
};

export type StartChoice = {
  readonly triggerMode: WorkflowTriggerMode;
  readonly chainAfterId: WorkflowRunId | null;
};

type Props = {
  readonly choice: StartChoice;
  readonly runs: ReadonlyArray<ChainRun>;
  readonly disabled: boolean;
  readonly onChange: (choice: StartChoice) => void;
};

type Option = {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly choice: StartChoice;
};

const isSameChoice = ({ a, b }: { readonly a: StartChoice; readonly b: StartChoice }) =>
  a.triggerMode === b.triggerMode &&
  (a.triggerMode !== 'after_run' || a.chainAfterId === b.chainAfterId);

export const StartsChip = ({ choice, runs, disabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-72' });
  const { open, close, toggle } = dropdown;
  const options: ReadonlyArray<Option> = [
    {
      key: 'immediate',
      label: 'Now',
      hint: 'Runs as soon as you start it.',
      choice: { triggerMode: 'immediate', chainAfterId: null },
    },
    {
      key: 'manual',
      label: 'Manually',
      hint: 'Stays queued until you start it from the sidebar.',
      choice: { triggerMode: 'manual', chainAfterId: null },
    },
    ...runs.map(({ run, template }) => {
      const name = run.title ?? template.name;
      return {
        key: `after-${run.id}`,
        label: `After ${name}`,
        hint: `Starts once ${name} completes.`,
        choice: { triggerMode: 'after_run' as const, chainAfterId: run.id },
      };
    }),
  ];
  const current = options.find((option) => isSameChoice({ a: option.choice, b: choice }));

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="When to start"
      className="flex flex-col p-1"
      trigger={
        <ControlChip
          label="Starts"
          value={current?.label ?? 'Now'}
          isOpen={open}
          disabled={disabled}
          onToggle={toggle}
        />
      }
    >
      <div role="radiogroup" aria-label="When to start" className="flex flex-col">
        {options.map((option) => {
          const isActive = current?.key === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                onChange(option.choice);
                close();
              }}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover',
                isActive && 'bg-hover',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs text-foreground">{option.label}</span>
                <span className="text-2xs text-faint-foreground">{option.hint}</span>
              </span>
              {isActive ? (
                <Check size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </AnchoredPopover>
  );
};
