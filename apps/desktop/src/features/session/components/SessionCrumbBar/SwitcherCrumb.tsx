import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, CRUMB_LINK_CLASS } from './crumbClasses';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type MenuParams = Readonly<{
  close: () => void;
}>;

type SwitcherCrumbProps = {
  readonly label: string;
  readonly menuLabel: string;
  readonly icon?: LucideIcon;
  readonly accessory?: ReactNode;
  readonly menuHeight?: number;
  readonly onNavigate?: () => void;
  readonly children: (params: MenuParams) => ReactNode;
};

export const SwitcherCrumb = ({
  label,
  menuLabel,
  icon: Icon,
  accessory,
  menuHeight = 260,
  onNavigate,
  children,
}: SwitcherCrumbProps) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: menuHeight,
    expectedWidth: 256,
    width: 'w-64 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;

  const trigger =
    onNavigate == null ? (
      <button
        type="button"
        onClick={toggle}
        title={`${label}. ${menuLabel}.`}
        aria-current="page"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS)}
      >
        {Icon == null ? null : (
          <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        )}
        <span className="min-w-0 max-w-48 truncate">{label}</span>
        {accessory}
        <ChevronDown
          size={11}
          aria-hidden
          className={cn('shrink-0 text-faint-foreground', open && 'rotate-180')}
        />
      </button>
    ) : (
      <span className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={() => {
            close();
            onNavigate();
          }}
          className={cn(CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS)}
        >
          {Icon == null ? null : (
            <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
          )}
          <span className="min-w-0 truncate">{label}</span>
          {accessory}
        </button>
        <Tooltip content={menuLabel} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={toggle}
            aria-label={`${label}. ${menuLabel}.`}
            aria-haspopup="menu"
            aria-expanded={open}
            className="rounded-sm p-0.5 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronDown size={11} aria-hidden className={cn(open && 'rotate-180')} />
          </button>
        </Tooltip>
      </span>
    );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={menuLabel}
      className="bg-subtle"
      anchorClassName="flex min-w-0 items-center"
      trigger={trigger}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
        {children({ close })}
      </div>
    </AnchoredPopover>
  );
};
