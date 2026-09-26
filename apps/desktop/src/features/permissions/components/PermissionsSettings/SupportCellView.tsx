import { cn, tintClasses } from '@goodboy/ui';
import type { SupportCell } from '../../utils/providerSupport';

type Props = {
  readonly cell: SupportCell;
};

export const SupportCellView = ({ cell }: Props) => (
  <span className="flex min-w-0 flex-col">
    <span
      className={cn(
        'inline-flex items-center gap-1 text-secondary',
        cell.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(cell.tone).text,
      )}
    >
      <span aria-hidden>{cell.glyph}</span>
      {cell.word}
    </span>
    {cell.detail === null ? null : (
      <span className="text-meta text-faint-foreground">{cell.detail}</span>
    )}
  </span>
);
