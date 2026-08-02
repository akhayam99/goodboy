import { useMemo, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';

const MAX_INLINE_ERROR_LENGTH = 220;
const dangerTint = tintClasses('danger');

type RetryAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
};

type Props = {
  readonly message: string;
  readonly role?: 'alert';
  readonly className?: string;
  readonly iconTestId?: string;
  readonly retryAction?: RetryAction;
};

type TruncateParams = {
  readonly message: string;
  readonly maxLength: number;
};

const truncateMessage = ({ message, maxLength }: TruncateParams): string => {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength).trimEnd()}...`;
};

export const TurnErrorCallout = ({ message, role, className, iconTestId, retryAction }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const longMessage = message.length > MAX_INLINE_ERROR_LENGTH;
  const truncatedMessage = useMemo(
    () => truncateMessage({ message, maxLength: MAX_INLINE_ERROR_LENGTH }),
    [message],
  );
  const displayMessage = longMessage && !expanded ? truncatedMessage : message;

  return (
    <div
      role={role}
      className={cn(
        'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
        dangerTint.borderSoft,
        dangerTint.bgSoft,
        className,
      )}
    >
      <CircleAlert
        size={12}
        aria-hidden
        {...(iconTestId != null ? { 'data-testid': iconTestId } : {})}
        className={cn('mt-0.5 shrink-0', dangerTint.icon)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('min-w-0 break-words leading-relaxed', dangerTint.text)}>
          {displayMessage}
        </p>
        {longMessage ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className={cn(
              'w-fit rounded px-1 py-0.5 text-2xs font-medium',
              dangerTint.text,
              dangerTint.hoverBgSoft,
            )}
          >
            {expanded ? 'show less' : 'show full error'}
          </button>
        ) : null}
      </div>
      {retryAction != null ? (
        <button
          type="button"
          onClick={retryAction.onClick}
          disabled={retryAction.disabled === true}
          className={cn(
            'shrink-0 rounded border px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            dangerTint.text,
            dangerTint.borderSoft,
            dangerTint.bgSoft,
            dangerTint.hoverBg,
          )}
        >
          {retryAction.label}
        </button>
      ) : null}
    </div>
  );
};
