import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../../tint';

export type CrumbLead =
  | { readonly kind: 'icon'; readonly icon: LucideIcon; readonly className?: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'node'; readonly node: ReactNode };

export type CrumbState = {
  readonly word: string;
  readonly tone: Tone;
  readonly glyph?: LucideIcon;
};

export type CrumbMenuRow = {
  readonly id: string;
  readonly lead: CrumbLead;
  readonly label: string;
  readonly secondary: string | null;
  readonly metaA: ReactNode | null;
  readonly state: CrumbState | null;
  readonly isCurrent: boolean;
  readonly isDisabled: boolean;
  readonly indent: 0 | 1;
  readonly isMiddleTruncated?: boolean;
  readonly onSelect: () => void;
};

export type CrumbMenuGroup = {
  readonly id: string;
  readonly label: string | null;
  readonly rows: ReadonlyArray<CrumbMenuRow>;
};

export type CrumbMenuConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
};

export type CrumbMenuAction = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly hint?: string;
  readonly confirm: CrumbMenuConfirm | null;
  readonly onRun: () => void;
};

export type CrumbMenuWidth = 'narrow' | 'regular' | 'wide';

export type CrumbMenuModel = {
  readonly title: string;
  readonly context: string | null;
  readonly count: number | string | null;
  readonly triggerLabel: string;
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly width: CrumbMenuWidth;
  readonly filterPlaceholder: string | null;
};
