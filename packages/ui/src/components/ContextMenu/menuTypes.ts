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
  readonly hint?: string | null;
  readonly tooltip?: string | null;
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
  readonly tooltip?: string | null;
  readonly isActive?: boolean;
  readonly blockedReason?: string | null;
  readonly isDestructive?: boolean;
  readonly isDisabled?: boolean;
  readonly shouldStayOpen?: boolean;
  readonly confirm?: MenuConfirm | null;
  readonly choices?: ReadonlyArray<MenuChoice> | null;
  readonly onActive?: () => void;
  readonly onInactive?: () => void;
  readonly onSelect: (choice: string | null) => void | Promise<void>;
};

export type MenuRadioEntry = {
  readonly kind: 'radio';
  readonly key: string;
  readonly label: string;
  readonly choices: ReadonlyArray<MenuChoice>;
  readonly isDisabled?: boolean;
  readonly shouldStayOpen?: boolean;
  readonly onSelect: (choice: string) => void | Promise<void>;
};

export type MenuGroupEntry = {
  readonly kind: 'group';
  readonly key: string;
  readonly label: string;
  readonly items: ReadonlyArray<MenuItemEntry>;
};

export type MenuEntry =
  | MenuItemEntry
  | MenuRadioEntry
  | MenuGroupEntry
  | { readonly kind: 'separator'; readonly key: string }
  | { readonly kind: 'header'; readonly key: string; readonly label: string };

export type MenuPoint = {
  readonly x: number;
  readonly y: number;
};
