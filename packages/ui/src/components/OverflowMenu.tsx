import type { ComponentType, ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '../cn';
import { AnchoredPopover } from './AnchoredPopover';
import { Tooltip } from './Tooltip';
import { useDropdown } from '../useDropdown';

type IconProps = {
  readonly size?: number;
  readonly className?: string;
  readonly 'aria-hidden'?: boolean;
};

export type OverflowMenuItem =
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly label: string;
      readonly icon?: ComponentType<IconProps>;
      readonly onClick: () => void;
      readonly destructive?: boolean;
      readonly disabled?: boolean;
      readonly hint?: string;
    }
  | { readonly kind: 'separator'; readonly key: string }
  | { readonly kind: 'header'; readonly key: string; readonly label: string }
  | { readonly kind: 'empty'; readonly key: string; readonly label: string };

type OverflowMenuProps = {
  readonly items: ReadonlyArray<OverflowMenuItem>;
  readonly label?: string;
  readonly tooltip?: string;
  readonly triggerClassName?: string;
  readonly trigger?: ReactNode;
  readonly disabled?: boolean;
  readonly align?: 'left' | 'right';
};

export const OverflowMenu = ({
  items,
  label = 'More actions',
  tooltip,
  triggerClassName,
  trigger,
  disabled,
  align = 'right',
}: OverflowMenuProps) => {
  const dropdown = useDropdown({
    disabled,
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-[180px]',
    expectedHeight: 220,
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      className="py-1"
      trigger={
        <Tooltip content={tooltip ?? label} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={dropdown.toggle}
            disabled={disabled}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className={cn(
              'shrink-0 rounded p-1 motion-safe:transition-colors',
              disabled
                ? 'cursor-not-allowed text-muted-foreground/30'
                : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
              dropdown.open && 'bg-foreground/10 text-foreground',
              triggerClassName,
            )}
          >
            {trigger ?? <MoreVertical size={13} aria-hidden />}
          </button>
        </Tooltip>
      }
    >
      {items.map((item) => {
        if (item.kind === 'separator') {
          return <div key={item.key} aria-hidden className="my-1 h-px bg-border-soft" />;
        }
        if (item.kind === 'header') {
          return (
            <div
              key={item.key}
              className="px-2.5 pt-1.5 pb-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70"
            >
              {item.label}
            </div>
          );
        }
        if (item.kind === 'empty') {
          return (
            <div key={item.key} className="px-2.5 py-1.5 text-muted-foreground/50 italic">
              {item.label}
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              item.onClick();
              dropdown.close();
            }}
            className={cn(
              'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
              item.disabled
                ? 'cursor-not-allowed text-muted-foreground'
                : item.destructive
                  ? 'text-danger/90 hover:bg-danger/10 hover:text-danger'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
          >
            {Icon ? (
              <Icon size={11} aria-hidden className="shrink-0 text-muted-foreground/70" />
            ) : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint ? (
              <kbd className="font-mono text-2xs text-muted-foreground/60">{item.hint}</kbd>
            ) : null}
          </button>
        );
      })}
    </AnchoredPopover>
  );
};
