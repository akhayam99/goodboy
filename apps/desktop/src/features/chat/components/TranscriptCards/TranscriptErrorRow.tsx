import { CircleAlert } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';

const dangerTint = tintClasses('danger');

type Props = {
  readonly message: string;
};

export const TranscriptErrorRow = ({ message }: Props) => (
  <div className="flex w-full items-start gap-2 text-xs">
    <CircleAlert
      size={12}
      aria-hidden
      data-testid="transcript-error-icon"
      className={cn('shrink-0 translate-y-0.5', dangerTint.icon)}
    />
    <span className={cn('min-w-0 break-words', dangerTint.text)}>{message}</span>
  </div>
);
