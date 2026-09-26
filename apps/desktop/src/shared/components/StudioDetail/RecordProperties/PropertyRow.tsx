import { Tooltip } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { ICON_SIZE } from '../../conceptIcons';

type Props = {
  readonly fact: ResolvedFact;
};

export const PropertyRow = ({ fact }: Props) => {
  const Icon = fact.icon;
  const value = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-label text-foreground">
      {Icon == null ? null : (
        <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-faint-foreground" />
      )}
      <span className="min-w-0">{fact.node}</span>
    </span>
  );
  return (
    <div className="flex min-h-7 min-w-0 items-center gap-3 py-1">
      <span className="w-[84px] shrink-0 text-meta text-faint-foreground">{fact.label}</span>
      {fact.hint == null ? value : <Tooltip content={fact.hint}>{value}</Tooltip>}
    </div>
  );
};
