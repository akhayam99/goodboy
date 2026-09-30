import type { KeyboardEvent, ReactNode } from 'react';
import { KbdPill, Textarea } from '@goodboy/ui';

type Props = {
  readonly value: string;
  readonly placeholder: string;
  readonly suggestion: string | null;
  readonly origin?: ReactNode;
  readonly estimate?: ReactNode;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onAcceptSuggestion: () => void;
};

const TITLE_ID = 'workflow-title';
const TITLE_HINT_ID = 'workflow-title-hint';

type JoinParams = {
  readonly text: string;
};

export const joinTitleLines = ({ text }: JoinParams): string => {
  const lines = text.split('\n');
  if (lines.length === 1) {
    return text;
  }
  const last = lines.length - 1;
  return lines
    .map((line, index) =>
      index === 0 ? line.trimEnd() : index === last ? line.trimStart() : line.trim(),
    )
    .filter((line, index) => line !== '' || index === 0 || index === last)
    .join(' ');
};

export const BuilderTitleField = ({
  value,
  placeholder,
  suggestion,
  origin = null,
  estimate = null,
  disabled,
  onChange,
  onAcceptSuggestion,
}: Props) => {
  const isSuggesting = suggestion !== null && value === '';
  const hasAside = isSuggesting || origin !== null || estimate !== null;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab' || event.shiftKey || !isSuggesting) {
      return;
    }
    event.preventDefault();
    onAcceptSuggestion();
  };

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-start gap-2">
        <label htmlFor={TITLE_ID} className="sr-only">
          Workflow name
        </label>
        <Textarea
          id={TITLE_ID}
          rows={1}
          autoGrow
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(joinTitleLines({ text: event.target.value }))}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-describedby={isSuggesting ? TITLE_HINT_ID : undefined}
          className="min-w-0 flex-1 rounded-sm border-0 bg-transparent px-0 py-1 text-xl leading-7 font-semibold shadow-none placeholder:text-faint-foreground focus-visible:shadow-none"
        />
        {hasAside ? (
          <div className="flex h-9 shrink-0 items-center gap-2">
            {isSuggesting ? <KbdPill className="h-4 text-meta">Tab</KbdPill> : null}
            {origin}
            {estimate}
          </div>
        ) : null}
      </div>
      {isSuggesting ? (
        <p id={TITLE_HINT_ID} className="text-secondary text-faint-foreground">
          Suggested from the goal. Press Tab to keep it, or type to name it yourself.
        </p>
      ) : null}
    </div>
  );
};
