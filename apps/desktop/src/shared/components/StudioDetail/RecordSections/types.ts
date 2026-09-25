import type { ReactNode } from 'react';

export type RecordSectionKind = 'description' | 'tool' | 'conversation';

export type RecordSection = {
  readonly key: string;
  readonly kind: RecordSectionKind;
  readonly label: string;
  readonly summary?: ReactNode;
  readonly count?: number;
  readonly isCollapsible: boolean;
  readonly defaultOpen: boolean;
  readonly content: ReactNode;
};
