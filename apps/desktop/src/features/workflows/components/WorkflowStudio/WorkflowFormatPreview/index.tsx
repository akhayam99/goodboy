import { Button, Dialog } from '@goodboy/ui';
import type { FormattedWorkflow } from '@goodboy/core';
import { Lightbulb } from 'lucide-react';

type Props = {
  readonly open: boolean;
  readonly proposal: FormattedWorkflow | null;
  readonly currentStepNames: ReadonlyArray<string>;
  readonly onAccept: () => void;
  readonly onReject: () => void;
};

export const WorkflowFormatPreview = ({
  open,
  proposal,
  currentStepNames,
  onAccept,
  onReject,
}: Props) => {
  if (!proposal) {
    return null;
  }

  const before = currentStepNames.filter((s) => s.trim().length > 0);

  return (
    <Dialog
      open={open}
      onClose={onReject}
      size="lg"
      title="Formatted workflow"
      description="Review the cleaned steps before applying them to the composer."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onReject}>
            Discard
          </Button>
          <Button size="sm" onClick={onAccept}>
            Apply to composer
          </Button>
        </>
      }
    >
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
              <span className="mt-1 text-2xs text-muted-foreground/80">
                <span className="font-semibold uppercase tracking-wide">goal</span> {proposal.goal}
              </span>
            ) : null}
          </div>
        ) : null}

        {before.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">before</span>
            {before.map((name, i) => (
              <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 line-through opacity-70">
                {name}
              </span>
            ))}
          </div>
        ) : null}

        <ol className="flex flex-col gap-2">
          {proposal.steps.map((step, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-lg bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-2xs font-semibold text-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{step.name}</span>
                <span className="rounded bg-accent/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {step.role}
                </span>
              </div>
              {step.promptPrefix ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{step.promptPrefix}</p>
              ) : null}
              {step.expectedOutput ? (
                <p className="text-2xs italic text-muted-foreground/80">→ {step.expectedOutput}</p>
              ) : null}
            </li>
          ))}
        </ol>

        {proposal.suggestions.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-lg bg-warning/5 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
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
    </Dialog>
  );
};
