import { useState } from 'react';
import { cn } from '@goodboy/ui';
import { Check, Trash2, X } from 'lucide-react';
import type { Workflow } from '@goodboy/types';
import {
  AGENT_KIND_DEFAULTS,
  inferAgentKindFromName,
  ROLE_TO_KIND,
} from '../../../session/agent-kind';
import { StepRowCompact } from '../StepRowCompact';

type Props = {
  readonly template: Workflow;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
};

export function PresetCard({ template, active, onSelect, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
          active
            ? 'border-border-soft bg-primary/10 ring-1 ring-primary/30'
            : 'border-border-soft bg-muted/20 hover:border-border hover:bg-muted/40',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-foreground">{template.name}</span>
          <span className="ml-auto shrink-0 text-2xs text-muted-foreground/40">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </span>
        </div>
        {steps.length > 0 ? (
          <ol className="flex flex-col gap-1">
            {steps.map((step, i) => {
              const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
              return (
                <li key={step.id}>
                  <StepRowCompact
                    index={i}
                    kind={kind}
                    name={step.name}
                    model={step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model}
                    verbosity={step.verbosity ?? 'normal'}
                  />
                </li>
              );
            })}
          </ol>
        ) : null}
      </button>
      {confirming ? (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm backdrop-blur-sm">
          <span className="px-1 text-2xs text-muted-foreground">Delete?</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
              onDelete();
            }}
            title="confirm delete"
            aria-label={`confirm delete ${template.name}`}
            className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
          >
            <Check size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            title="cancel"
            aria-label="cancel delete"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <X size={12} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          title="delete workflow"
          aria-label={`delete ${template.name}`}
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:bg-danger/10 hover:!text-danger"
        >
          <Trash2 size={12} aria-hidden />
        </button>
      )}
    </li>
  );
}
