import type { ReactNode } from 'react';

export type ListboxValue = string | number;

export type ListboxStar = {
  readonly isStarred: boolean;
  readonly label: string;
  readonly tooltip: string;
  readonly isBusy?: boolean;
  readonly onToggle: () => void;
};

export type ListboxOption<T extends ListboxValue> = {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly leading?: ReactNode;
  readonly meta?: ReactNode;
  readonly group?: string;
  readonly disabledReason?: string;
  readonly keywords?: string;
  readonly isCode?: boolean;
  readonly star?: ListboxStar;
};

export type ListboxTriggerVariant = 'field' | 'quiet' | 'chip';

export type ListboxSize = 'sm' | 'md';

export type ListboxCreate = {
  readonly label: (query: string) => string;
  readonly onCreate: (query: string) => void;
};
