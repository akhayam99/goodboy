import type { ReactNode } from 'react';
import { WrapText } from 'lucide-react';
import { Button, DiffLayoutToggle, cn, type DiffLayoutMode } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly layout: DiffLayoutMode;
  readonly onLayout: (mode: DiffLayoutMode) => void;
  readonly wrap: boolean;
  readonly onWrap: (next: boolean) => void;
  readonly end?: ReactNode;
};

export const DiffToolbar = ({ layout, onLayout, wrap, onWrap, end }: Props) => {
  const isSplit = layout === 'split';
  return (
    <div data-slot="diff-toolbar" className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="ml-auto flex items-center gap-2">
        <DiffLayoutToggle mode={layout} onChange={onLayout} />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isSplit || wrap}
          disabled={isSplit}
          title={isSplit ? 'Split view always wraps' : undefined}
          onClick={() => onWrap(!wrap)}
          className={cn((isSplit || wrap) && 'bg-hover text-foreground')}
        >
          <WrapText size={ICON_SIZE.row} aria-hidden />
          Wrap
        </Button>
        {end}
      </div>
    </div>
  );
};
