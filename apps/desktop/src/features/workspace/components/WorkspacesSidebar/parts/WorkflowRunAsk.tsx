import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly goal: string;
  readonly processText: string;
};

export const WorkflowRunAsk = ({ goal, processText }: Props) => {
  const [processOpen, setProcessOpen] = useState(false);

  if (goal === '' && processText === '') {
    return null;
  }

  return (
    <section aria-label="what you asked for" className="flex flex-col gap-2">
      <SectionHeader label="Goal" />
      {goal !== '' ? (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{goal}</p>
      ) : (
        <p className="text-xs italic leading-relaxed text-muted-foreground/70">
          No goal was set for this run.
        </p>
      )}
      {processText !== '' ? (
        <>
          <button
            type="button"
            onClick={() => setProcessOpen((open) => !open)}
            aria-expanded={processOpen}
            className="flex items-center gap-1 self-start rounded text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {processOpen ? (
              <ChevronDown size={11} aria-hidden className="shrink-0" />
            ) : (
              <ChevronRight size={11} aria-hidden className="shrink-0" />
            )}
            How you described the process
          </button>
          {processOpen ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {processText}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
