import { ChevronsDown } from 'lucide-react';
import { Divider } from '@goodboy/ui';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  step: number;
  rendered: number;
  total: number;
  onShowMore: () => void;
};

export const ShowMoreBar = ({ step, rendered, total, onShowMore }: Props) => {
  return (
    <>
      <Divider />
      <div className="flex flex-col items-center gap-1 bg-muted/20 py-3">
        <button
          type="button"
          onClick={onShowMore}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          <ChevronsDown size={ICON_SIZE.row} aria-hidden />
          Show {formatInteger(step)} more lines
        </button>
        <span className="text-3xs text-muted-foreground/60">
          showing {formatInteger(rendered)} of {formatInteger(total)} lines
        </span>
      </div>
    </>
  );
};
