import type { KeyboardEvent, ReactNode } from 'react';
import { Input, KbdPill } from '@goodboy/ui';

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

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || !isSuggesting) {
      return;
    }
    event.preventDefault();
    onAcceptSuggestion();
  };

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <label htmlFor={TITLE_ID} className="sr-only">
          Workflow name
        </label>
        <Input
          id={TITLE_ID}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-describedby={isSuggesting ? TITLE_HINT_ID : undefined}
          className="h-8 min-w-0 flex-1 rounded-sm border-0 bg-transparent px-0 text-xl font-semibold placeholder:text-faint-foreground"
        />
        {isSuggesting ? <KbdPill className="h-4 text-3xs">Tab</KbdPill> : null}
        {origin}
        {estimate}
      </div>
      {isSuggesting ? (
        <p id={TITLE_HINT_ID} className="text-2xs text-faint-foreground">
          Suggested from the goal. Press Tab to keep it, or type to name it yourself.
        </p>
      ) : null}
    </div>
  );
};
