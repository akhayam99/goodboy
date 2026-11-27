import { Tooltip, cn } from '@goodboy/ui';
import { useBriefFit } from './useBriefFit';

type Props = {
  readonly text: string;
  readonly className?: string;
};

export const LeadTreeBrief = ({ text, className }: Props) => {
  const { ref, shown } = useBriefFit({ text });
  return (
    <Tooltip content={text} anchorClassName="flex min-w-0 flex-1">
      <span
        ref={ref}
        data-lead-tree-title=""
        className={cn('min-w-0 flex-1 truncate text-row', className)}
      >
        {shown}
      </span>
    </Tooltip>
  );
};
