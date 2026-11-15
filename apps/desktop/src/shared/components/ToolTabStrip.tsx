import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { IconButton, ScrollFade } from '@goodboy/ui';

type Props = {
  readonly newLabel: string;
  readonly newTooltip?: string;
  readonly newShortcut?: string;
  readonly onNew: () => void;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
};

export const ToolTabStrip = ({
  newLabel,
  newTooltip,
  newShortcut,
  onNew,
  trailing = null,
  children,
}: Props) => (
  <div data-tool-tab-strip="" className="flex h-10 shrink-0 items-center gap-1 px-3">
    <ScrollFade
      orientation="horizontal"
      className="min-w-0 shrink"
      viewportClassName="flex items-center"
    >
      {children}
    </ScrollFade>
    <IconButton
      icon={Plus}
      label={newLabel}
      tooltip={newTooltip}
      shortcut={newShortcut}
      size="sm"
      variant="ghost"
      tooltipSide="top"
      onClick={onNew}
    />
    {trailing === null ? null : (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">{trailing}</div>
    )}
  </div>
);
