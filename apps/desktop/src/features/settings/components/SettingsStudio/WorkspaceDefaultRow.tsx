import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly help: string;
  readonly children: ReactNode;
};

export const WorkspaceDefaultRow = ({ label, help, children }: Props) => (
  <div className="flex min-h-9 min-w-0 items-center justify-between gap-3">
    <span className="flex min-w-0 items-center gap-1.5 text-label font-medium text-foreground">
      <span className="truncate">{label}</span>
      <Tooltip content={help} anchorClassName="flex shrink-0">
        <span
          tabIndex={0}
          role="img"
          aria-label={help}
          className="rounded-sm text-faint-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Info size={ICON_SIZE.row} aria-hidden />
        </span>
      </Tooltip>
    </span>
    <div className="shrink-0">{children}</div>
  </div>
);
