import { ArrowLeft } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';
import { buttonClasses } from './Button';

type Props = {
  readonly kind: string;
  readonly title: string | null;
  readonly onBack: () => void;
};

export const DrawerBackChip = ({ kind, title, onBack }: Props) => {
  const label = title === null ? kind : `${kind} · ${title}`;
  return (
    <button
      type="button"
      data-drawer-back-chip=""
      aria-label={`Back to ${label}`}
      className={cn(
        buttonClasses({ variant: 'secondary', size: 'xs' }),
        'min-w-0 max-w-1/2 shrink justify-start',
      )}
      onClick={onBack}
    >
      <ArrowLeft size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="shrink-0">{kind}</span>
      {title === null ? null : (
        <span className="min-w-0 truncate text-muted-foreground">· {title}</span>
      )}
    </button>
  );
};
