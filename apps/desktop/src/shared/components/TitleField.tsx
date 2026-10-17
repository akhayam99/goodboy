import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { ICON_SIZE, cn } from '@goodboy/ui';
import { LimitRing } from './LimitRing';

type Props = {
  readonly density: 'title' | 'row';
  readonly ariaLabel: string;
  readonly draft: string;
  readonly maxLength: number;
  readonly used: number;
  readonly limit: number;
  readonly error: string | null;
  readonly lead?: ReactNode;
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
  lead,
  onDraftChange,
  onKeyDown,
  onBlur,
}: Props) => {
  const ringId = useId();
  const errorId = useId();
  const hasError = error !== null;
  const isTitle = density === 'title';
  const alert = hasError ? (
    <span
      id={errorId}
      role="alert"
      className={cn('truncate text-meta text-danger', isTitle && 'max-w-[40%] shrink-0')}
    >
      {error}
    </span>
  ) : null;
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
        autoFocus
        type="text"
        value={draft}
        maxLength={maxLength}
        aria-label={ariaLabel}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${ringId} ${errorId}` : ringId}
        spellCheck={false}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={cn(
          'min-w-0 flex-1 bg-transparent p-0 text-foreground outline-none',
          isTitle ? 'text-title' : 'text-ui',
        )}
      />
      {isTitle ? alert : null}
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
      {alert}
    </span>
  );
};
