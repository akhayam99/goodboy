import { CircleAlert } from 'lucide-react';
import { ClampedProse, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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

export const TurnErrorCallout = ({ message, role, className, iconTestId, retryAction }: Props) => {
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
        size={ICON_SIZE.row}
        aria-hidden
        {...(iconTestId != null ? { 'data-testid': iconTestId } : {})}
        className={cn('mt-0.5 shrink-0', dangerTint.icon)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <ClampedProse
          text={message}
          lines={3}
          className={cn('min-w-0 break-words text-xs leading-relaxed', dangerTint.text)}
        />
      </div>
      {retryAction != null ? (
        <button
          type="button"
          onClick={retryAction.onClick}
          disabled={retryAction.disabled === true}
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
