import type { ReactNode } from 'react';
import { Plus } from '@goodboy/ui/icons';
import { DockToolRow, IconButton, ScrollFade, cn } from '@goodboy/ui';

type Props = {
  readonly newLabel: string;
  readonly newTooltip?: string;
  readonly newShortcut?: string;
  readonly onNew: () => void;
  readonly scope?: ReactNode;
  readonly trailing?: ReactNode;
  readonly isUnderHead?: boolean;
  readonly children: ReactNode;
};

export const ToolTabStrip = ({
  newLabel,
  newTooltip,
  newShortcut,
  onNew,
  scope = null,
  trailing = null,
  isUnderHead = false,
  children,
}: Props) => (
  <div data-tool-tab-strip="" className="contents">
    <DockToolRow scope={scope} actions={trailing} className={cn(!isUnderHead && 'h-10')}>
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
    </DockToolRow>
  </div>
);
