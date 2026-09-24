import type { ComponentType } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

const dangerTint = tintClasses('danger');

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
      readonly description?: string;
      readonly icon?: ComponentType<IconProps>;
      readonly tone?: Tone;
      readonly onClick: () => void;
      readonly destructive?: boolean;
      readonly disabled?: boolean;
      readonly hint?: string;
    }
  | { readonly kind: 'separator'; readonly key: string }
  | { readonly kind: 'header'; readonly key: string; readonly label: string }
  | { readonly kind: 'empty'; readonly key: string; readonly label: string };

type Props = {
  readonly items: ReadonlyArray<OverflowMenuItem>;
  readonly onClose: () => void;
};

export const MenuItems = ({ items, onClose }: Props) => (
  <>
    {items.map((item) => {
      if (item.kind === 'separator') {
        return <div key={item.key} aria-hidden className="my-1 h-px bg-border-soft" />;
      }
      if (item.kind === 'header') {
        return (
          <div
            key={item.key}
            className="px-2.5 pt-1.5 pb-0.5 text-2xs font-semibold uppercase tracking-eyebrow text-faint-foreground"
          >
            {item.label}
          </div>
        );
      }
      if (item.kind === 'empty') {
        return (
          <div key={item.key} className="px-2.5 py-1.5 text-faint-foreground italic">
            {item.label}
          </div>
        );
      }
      const Icon = item.icon;
      const hasDescription = item.description != null;
      return (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled === true) {
              return;
            }
            item.onClick();
            onClose();
          }}
          className={cn(
            'flex w-full gap-2 px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-hover',
            hasDescription ? 'items-start py-2' : 'items-center py-1.5',
            item.disabled === true
              ? 'cursor-not-allowed text-muted-foreground'
              : item.destructive === true
                ? cn(dangerTint.text, dangerTint.hoverBg, dangerTint.hoverText)
                : 'text-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          {Icon ? (
            <Icon
              size={hasDescription ? 13 : 11}
              aria-hidden
              className={cn(
                'shrink-0',
                hasDescription && 'mt-px',
                item.tone == null ? 'text-faint-foreground' : tintClasses(item.tone).icon,
              )}
            />
          ) : null}
          {hasDescription ? (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{item.label}</span>
              <span className="text-2xs text-muted-foreground">{item.description}</span>
            </span>
          ) : (
            <span className="flex-1 truncate">{item.label}</span>
          )}
          {item.hint != null ? (
            <kbd className="font-mono text-2xs text-faint-foreground">{item.hint}</kbd>
          ) : null}
        </button>
      );
    })}
  </>
);
