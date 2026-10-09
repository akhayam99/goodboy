import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { tintClasses } from '../../tint';
import { Tooltip } from '../Tooltip';
import { ICON_SIZE } from '../../iconSize';

export type ReportSheetAttachment = {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly included: boolean;
  readonly isError?: boolean;
};

type Props = {
  readonly attachment: ReportSheetAttachment;
  readonly onToggle: (id: string) => void;
};

const dangerTint = tintClasses('danger');

export const AttachmentChip = ({ attachment, onToggle }: Props) => {
  if (!attachment.included) {
    return (
      <button
        type="button"
        onClick={() => onToggle(attachment.id)}
        aria-label={`Attach ${attachment.label}`}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2 text-chip text-faint-foreground hover:bg-hover hover:text-muted-foreground',
          FOCUS_RING,
        )}
      >
        <Plus size={ICON_SIZE.row} aria-hidden />
        <span className="max-w-60 truncate line-through">{attachment.label}</span>
      </button>
    );
  }
  const isError = attachment.isError === true;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full bg-fill pl-2 pr-0.5 text-chip text-muted-foreground',
        isError ? cn('ring-1', dangerTint.ring) : '',
      )}
    >
      {attachment.icon != null ? (
        <span
          className={cn('inline-flex shrink-0', isError ? 'text-danger' : 'text-faint-foreground')}
          aria-hidden
        >
          {attachment.icon}
        </span>
      ) : null}
      <span className="max-w-60 truncate">{attachment.label}</span>
      <Tooltip content="Leave it out">
        <button
          type="button"
          onClick={() => onToggle(attachment.id)}
          aria-label={`Remove ${attachment.label}`}
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-full text-faint-foreground hover:bg-hover hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <X size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
};
