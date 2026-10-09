import { Button } from '@goodboy/ui';
import { openCommentsLine } from '../../reviewBulkCopy';
import { fixLabel } from '../../reviewLaunchCopy';

type Props = {
  readonly count: number;
  readonly onFix: () => void;
};

export const FixOpenLine = ({ count, onFix }: Props) => (
  <div className="flex min-w-0 flex-wrap items-center gap-3">
    <span className="text-label text-foreground">{openCommentsLine({ count })}</span>
    <Button size="sm" variant="secondary" onClick={onFix}>
      {fixLabel({ count })}
    </Button>
  </div>
);
