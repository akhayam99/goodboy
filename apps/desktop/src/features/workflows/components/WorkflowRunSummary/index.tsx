import { Check, Circle } from 'lucide-react';
import { Markdown, SectionHeader } from '@goodboy/ui';

type Props = {
  readonly summary: string | undefined;
};

type Structured = {
  readonly done: ReadonlyArray<string>;
  readonly left: ReadonlyArray<string>;
};

const stringList = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
    : [];

const parseStructured = (text: string): Structured | null => {
  if (!text.startsWith('{')) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record['done']) && !Array.isArray(record['left'])) {
      return null;
    }
    return { done: stringList(record['done']), left: stringList(record['left']) };
  } catch {
    return null;
  }
};

type GroupProps = {
  readonly label: string;
  readonly entries: ReadonlyArray<string>;
  readonly tone: 'done' | 'left';
};

const RecapGroup = ({ label, entries, tone }: GroupProps) => (
  <div className="flex min-w-0 flex-col gap-1">
    <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <ul className="flex min-w-0 flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry} className="flex min-w-0 items-start gap-1.5 text-2xs leading-relaxed">
          {tone === 'done' ? (
            <Check className="mt-0.5 size-3 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <Circle
              className="mt-1 size-1.5 shrink-0 fill-current text-muted-foreground"
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
  const structured = parseStructured(text);
  if (structured !== null && structured.done.length === 0 && structured.left.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="workflow-run-summary"
      aria-label="Recap"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <SectionHeader label="Recap" />
      {structured === null ? (
        <Markdown text={text} className="text-2xs leading-relaxed" />
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
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
