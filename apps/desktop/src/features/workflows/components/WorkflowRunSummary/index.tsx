import { Check, Circle } from 'lucide-react';
import { Markdown, SectionHeader, Eyebrow } from '@goodboy/ui';
import { parseRunSummaryText } from '@goodboy/core';

type Props = {
  readonly summary: string | undefined;
};

type GroupProps = {
  readonly label: string;
  readonly entries: ReadonlyArray<string>;
  readonly tone: 'done' | 'left';
};

const RecapGroup = ({ label, entries, tone }: GroupProps) => (
  <div className="flex min-w-0 flex-col gap-1">
    <Eyebrow label={label} />
    <ul className="flex min-w-0 flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry} className="flex min-w-0 items-start gap-1.5 text-xs leading-relaxed">
          {tone === 'done' ? (
            <Check className="mt-1 size-3 shrink-0 text-success" aria-hidden />
          ) : (
            <Circle
              className="mt-1.5 size-1.5 shrink-0 fill-current text-muted-foreground"
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1">{entry}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const WorkflowRunSummary = ({ summary }: Props) => {
  const text = summary?.trim() ?? '';
  if (text === '') {
    return null;
  }
  const structured = parseRunSummaryText(text);
  if (structured !== null && structured.done.length === 0 && structured.left.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="workflow-run-summary"
      aria-label="Recap"
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionHeader label="Recap" />
      {structured === null ? (
        <Markdown text={text} className="text-xs leading-relaxed" />
      ) : (
        <div
          data-testid="workflow-run-summary-groups"
          className="grid min-w-0 gap-3 sm:grid-cols-2"
        >
          {structured.done.length > 0 && (
            <RecapGroup label="Done" entries={structured.done} tone="done" />
          )}
          {structured.left.length > 0 && (
            <RecapGroup label="Left" entries={structured.left} tone="left" />
          )}
        </div>
      )}
    </section>
  );
};
