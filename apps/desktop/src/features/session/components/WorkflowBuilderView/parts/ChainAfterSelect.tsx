import { useRef, useState } from 'react';
import { Check, ChevronDown, Link2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Workflow, WorkflowRunId } from '@goodboy/types';
import { useClickOutside } from '../../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../../shared/hooks/useDropdownDirection';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../../dropdown-utils';

type ChainRun = { readonly run: { readonly id: WorkflowRunId }; readonly template: Workflow };

type Props = {
  readonly runs: ReadonlyArray<ChainRun>;
  readonly value: WorkflowRunId | null;
  readonly disabled: boolean;
  readonly onChange: (id: WorkflowRunId) => void;
};

export const ChainAfterSelect = ({ runs, value, disabled, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);
  const selected = runs.find((r) => r.run.id === value) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="run after which workflow"
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Link2 size={11} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="max-w-[12rem] truncate font-medium text-foreground">
          {selected?.template.name ?? 'Select workflow'}
        </span>
        <ChevronDown
          size={11}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={cn(POPUP_BASE, 'min-w-[12rem]', direction === 'up' ? POPUP_UP : POPUP_DOWN)}
        >
          {runs.map(({ run, template }) => {
            const active = run.id === value;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  onChange(run.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span className="flex-1 truncate">{template.name}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
