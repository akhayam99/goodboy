import type { ComponentType } from 'react';

type IconProps = {
  readonly size?: number;
  readonly className?: string;
  readonly 'aria-hidden'?: boolean;
};

export type MenuConfirmRole = 'primary' | 'alert' | 'danger';

export type MenuConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly role: MenuConfirmRole;
  readonly notes?: ReadonlyArray<string>;
  readonly alt?: {
    readonly label: string;
    readonly onSelect: () => void | Promise<void>;
  };
};

export type MenuChoice = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
};

export type MenuItemEntry = {
  readonly kind: 'item';
  readonly key: string;
  readonly label: string;
  readonly ariaLabel?: string | null;
  readonly icon?: ComponentType<IconProps>;
  readonly iconClassName?: string | null;
  readonly hint?: string | null;
  readonly isExternal?: boolean;
  readonly description?: string | null;
  readonly blockedReason?: string | null;
  readonly isDestructive?: boolean;
  readonly isDisabled?: boolean;
  readonly confirm?: MenuConfirm | null;
  readonly choices?: ReadonlyArray<MenuChoice> | null;
  readonly onActive?: () => void;
  readonly onInactive?: () => void;
  readonly onSelect: (choice: string | null) => void | Promise<void>;
};

export type MenuEntry =
  | MenuItemEntry
  | { readonly kind: 'separator'; readonly key: string }
  | { readonly kind: 'header'; readonly key: string; readonly label: string };

export type MenuPoint = {
  readonly x: number;
  readonly y: number;
};
