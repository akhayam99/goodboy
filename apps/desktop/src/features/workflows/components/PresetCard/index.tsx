import { useState } from 'react';
import { SelectableRow } from '@goodboy/ui';
import { Check, Trash2, X } from 'lucide-react';
import type { Workflow } from '@goodboy/types';
import { inferAgentKindFromName, ROLE_TO_KIND } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { WorkflowOriginTag } from '../WorkflowOriginTag';

type Props = {
  readonly template: Workflow;
  readonly active: boolean;
  readonly approved: boolean;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
};

export const PresetCard = ({ template, active, approved, onSelect, onDelete }: Props) => {
  const [confirming, setConfirming] = useState(false);
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  const description = template.description?.trim();
  return (
    <li className="group relative">
      <SelectableRow
        selected={active}
        ariaCurrent={active}
        onClick={onSelect}
        className="flex-col gap-1.5 px-2.5 py-2"
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{template.name}</span>
          {!approved ? (
            <span className="shrink-0 rounded-md bg-warning/15 px-1 py-px text-2xs font-semibold uppercase leading-none tracking-eyebrow text-warning">
              draft
            </span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {template.origin != null ? <WorkflowOriginTag origin={template.origin} /> : null}
            <span className="text-2xs tabular-nums text-muted-foreground/50">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </span>
          </span>
        </div>
        {description ? (
          <span className="line-clamp-1 text-2xs text-muted-foreground/70">{description}</span>
        ) : null}
        {steps.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2 pr-8">
            {steps.map((step) => {
              const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
              return <AgentAvatar key={step.id} kind={kind} size="xs" title={step.name} />;
            })}
          </span>
        ) : null}
      </SelectableRow>
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
            className="rounded-md p-0.5 text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-danger/10"
          >
            <Check size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            title="Cancel delete"
            aria-label="Cancel delete"
            className="rounded-md p-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
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
          className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground/0 focus-visible:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-danger/10 group-focus-within:text-muted-foreground group-hover:text-muted-foreground hover:!text-danger"
        >
          <Trash2 size={12} aria-hidden />
        </button>
      )}
    </li>
  );
};
