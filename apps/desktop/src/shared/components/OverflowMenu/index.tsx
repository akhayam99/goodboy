import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { Popover, cn } from '@goodboy/ui';

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
  readonly triggerClassName?: string;
  readonly trigger?: ReactNode;
  readonly disabled?: boolean;
  readonly align?: 'left' | 'right';
  readonly side?: 'top' | 'bottom';
};

export const OverflowMenu = ({
  items,
  label = 'more actions',
  triggerClassName,
  trigger,
  disabled,
  align = 'right',
  side = 'bottom',
}: OverflowMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'shrink-0 rounded p-1 motion-safe:transition-colors',
          disabled
            ? 'cursor-not-allowed text-muted-foreground/30'
            : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
          open && 'bg-foreground/10 text-foreground',
          triggerClassName,
        )}
      >
        {trigger ?? <MoreVertical size={13} aria-hidden />}
      </button>
      {open ? (
        <Popover
          role="menu"
          ariaLabel={label}
          className={cn(
            'absolute z-30 min-w-[180px] py-1',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
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
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
                  item.disabled
                    ? 'cursor-not-allowed text-muted-foreground/40'
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
        </Popover>
      ) : null}
    </div>
  );
};
