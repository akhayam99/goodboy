import type { ComponentType } from 'react';

type IconProps = {
  readonly size?: number;
  readonly className?: string;
  readonly 'aria-hidden'?: boolean;
};

export type MenuConfirmRole = 'alert' | 'danger';

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
  readonly icon?: ComponentType<IconProps>;
  readonly hint?: string | null;
  readonly description?: string | null;
  readonly blockedReason?: string | null;
  readonly isDestructive?: boolean;
  readonly confirm?: MenuConfirm | null;
  readonly choices?: ReadonlyArray<MenuChoice> | null;
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
