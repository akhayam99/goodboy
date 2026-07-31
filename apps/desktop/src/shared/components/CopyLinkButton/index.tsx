import { Check, Link2, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { useCopyLink } from '../../hooks/useCopyLink';

type Props = {
  readonly url: string;
  readonly label: string;
  readonly size?: number;
  readonly className?: string;
};

export const CopyLinkButton = ({ url, label, size = 11, className }: Props) => {
  const { copied, failed, copy } = useCopyLink();

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copy(url);
      }}
      title={failed ? 'copy failed' : `Copy ${label} link`}
      aria-label={`Copy ${label} link`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md p-1 transition-colors',
        copied && 'text-success',
        failed && 'text-danger',
        !copied && !failed && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        className,
      )}
    >
      {copied ? (
        <Check size={size} aria-hidden />
      ) : failed ? (
        <X size={size} aria-hidden />
      ) : (
        <Link2 size={size} aria-hidden />
      )}
    </button>
  );
};
