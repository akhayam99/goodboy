import { Wrench } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChangelogFix } from '../../parseChangelog';
import { AreaTag } from './AreaTag';
import { PrRef } from './PrRef';

type Props = {
  readonly fix: ChangelogFix;
  readonly showPrRef: boolean;
};

export const FixRow = ({ fix, showPrRef }: Props) => (
  <div className="flex items-start justify-between gap-2 py-1">
    <div className="flex min-w-0 items-start gap-1.5">
      <Wrench size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{fix.text}</span>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <AreaTag area={fix.area} />
      {showPrRef ? <PrRef prs={fix.prs} /> : null}
    </div>
  </div>
);
