import { useEffect, useState } from 'react';
import { Button, Dialog, Textarea, cn } from '@goodboy/ui';
import type { FormattedWorkflow } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import { Lightbulb } from 'lucide-react';
import { AGENT_KIND_PALETTE, ROLE_TO_KIND } from '../../../../session/agent-kind';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly open: boolean;
  readonly formatting: boolean;
  readonly proposal: FormattedWorkflow | null;
  readonly currentStepNames: ReadonlyArray<string>;
  readonly onFormat: (description: string) => void;
  readonly onApply: () => void;
  readonly onClose: () => void;
};

export const WorkflowFormatPreview = ({
  open,
  formatting,
  proposal,
  currentStepNames,
  onFormat,
  onApply,
  onClose,
}: Props) => {
  const [text, setText] = useState('');

  // Reset the draft each time the overlay opens so a prior session never leaks in.
  useEffect(() => {
    if (open) {
      setText('');
    }
  }, [open]);

  const before = currentStepNames.filter((s) => s.trim().length > 0);
  const canFormat = text.trim().length > 0 && !formatting;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Format the workflow"
      description="Describe the workflow in plain language, then review the steps before applying."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={formatting}>
            {proposal ? 'Discard' : 'Cancel'}
          </Button>
          {proposal ? (
            <Button size="sm" onClick={onApply}>
              Apply to composer
            </Button>
          ) : (
            <Button size="sm" onClick={() => onFormat(text)} disabled={!canFormat}>
              <CONCEPT_ICONS.enhance size={13} aria-hidden />
              {formatting ? 'Formatting…' : 'Format'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="workflow-format-input"
            className="text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground/70"
          >
            describe the workflow
          </label>
          <Textarea
            id="workflow-format-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. plan the change, implement it carefully, then run tests and review the diff"
            disabled={formatting}
          />
        </div>

        {proposal ? (
          <div className="flex flex-col gap-5">
            {proposal.name || proposal.description ? (
              <div className="flex flex-col gap-1">
                {proposal.name ? (
                  <span className="text-sm font-semibold text-foreground">{proposal.name}</span>
                ) : null}
                {proposal.description ? (
                  <span className="text-xs text-muted-foreground">{proposal.description}</span>
                ) : null}
                {proposal.goal ? (
                  <span className="text-2xs text-muted-foreground/80">
                    <span className="font-semibold uppercase tracking-eyebrow">goal</span>{' '}
                    {proposal.goal}
                  </span>
                ) : null}
              </div>
            ) : null}

            {before.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-eyebrow">before</span>
                {before.map((name, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-muted/60 px-1.5 py-0.5 line-through opacity-70"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : null}

            <ol className="flex flex-col gap-2">
              {proposal.steps.map((step, i) => {
                const kind = ROLE_TO_KIND[step.role as AgentRole] ?? 'generic';
                return (
                  <li key={i} className="flex flex-col gap-1 rounded-lg bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-2xs font-semibold tabular-nums text-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{step.name}</span>
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-px text-2xs font-semibold uppercase tracking-eyebrow',
                          AGENT_KIND_PALETTE[kind].fg,
                        )}
                      >
                        {AGENT_KIND_PALETTE[kind].label}
                      </span>
                    </div>
                    {step.promptPrefix ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {step.promptPrefix}
                      </p>
                    ) : null}
                    {step.expectedOutput ? (
                      <p className="text-2xs italic text-muted-foreground/80">
                        → {step.expectedOutput}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {proposal.suggestions.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-lg bg-warning/5 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                  <Lightbulb size={11} aria-hidden /> suggestions
                </span>
                <ul className="flex flex-col gap-1">
                  {proposal.suggestions.map((s, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};
