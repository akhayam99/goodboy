import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyLine, ClampedProse, Markdown, SectionHeader } from '@goodboy/ui';

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
    <section aria-label="What you asked for" className="flex flex-col gap-2">
      <SectionHeader label="Goal" />
      {goal !== '' ? (
        <ClampedProse text={goal} lines={2} className="text-label text-foreground" />
      ) : (
        <EmptyLine className="text-label italic text-faint-foreground">
          No goal was set for this run.
        </EmptyLine>
      )}
      {processText !== '' ? (
        <>
          <button
            type="button"
            onClick={() => setProcessOpen((open) => !open)}
            aria-expanded={processOpen}
            className="flex items-center gap-1 self-start rounded-md text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            {processOpen ? (
              <ChevronDown size={11} aria-hidden className="shrink-0" />
            ) : (
              <ChevronRight size={11} aria-hidden className="shrink-0" />
            )}
            How you described the process
          </button>
          {processOpen ? (
            <Markdown text={processText} className="text-label text-muted-foreground" />
          ) : null}
        </>
      ) : null}
    </section>
  );
};
