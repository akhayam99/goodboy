import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ICON_SIZE, cn } from '@goodboy/ui';
import { LimitRing } from './LimitRing';
import { RenameStatus } from './RenameStatus';

type Props = {
  readonly density: 'title' | 'row';
  readonly ariaLabel: string;
  readonly draft: string;
  readonly maxLength: number;
  readonly used: number;
  readonly limit: number;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly onRetry: () => void;
  readonly lead?: ReactNode;
  readonly initialCaret?: number | null;
  readonly onDraftChange: (draft: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onBlur: () => void;
};

export const TitleField = ({
  density,
  ariaLabel,
  draft,
  maxLength,
  used,
  limit,
  error,
  isPending,
  onRetry,
  lead,
  initialCaret = null,
  onDraftChange,
  onKeyDown,
  onBlur,
}: Props) => {
  const ringId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasError = error !== null;
  const isTitle = density === 'title';
  useEffect(() => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    input.focus();
    if (initialCaret !== null) {
      const at = Math.min(initialCaret, input.value.length);
      input.setSelectionRange(at, at);
      return;
    }
    input.setSelectionRange(0, input.value.length, 'backward');
    input.scrollLeft = 0;
  }, []);

  const status = (
    <RenameStatus
      isPending={isPending}
      error={error}
      onRetry={onRetry}
      {...(isTitle ? { className: 'max-w-[40%] shrink-0' } : {})}
    />
  );
  const field = (
    <span
      data-title-field={density}
      className={cn(
        'relative flex w-full min-w-0 gap-2',
        isTitle ? 'items-baseline' : 'h-7 items-center rounded-md bg-hover px-2',
      )}
    >
      {isTitle ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full',
            hasError ? 'bg-danger' : 'bg-border',
          )}
        />
      ) : null}
      {lead}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={maxLength}
        aria-label={ariaLabel}
        aria-invalid={hasError}
        aria-busy={isPending}
        readOnly={isPending}
        aria-describedby={ringId}
        spellCheck={false}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={cn(
          'min-w-0 flex-1 bg-transparent p-0 text-foreground outline-none',
          isTitle ? 'text-title' : 'text-ui',
        )}
      />
      {isTitle ? status : null}
      <LimitRing
        id={ringId}
        used={used}
        limit={limit}
        size={isTitle ? ICON_SIZE.control : ICON_SIZE.row}
      />
    </span>
  );
  if (isTitle) {
    return field;
  }
  return (
    <span className="flex w-full min-w-0 flex-col gap-1">
      {field}
      {status}
    </span>
  );
};
