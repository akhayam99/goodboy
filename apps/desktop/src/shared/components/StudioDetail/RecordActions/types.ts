import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type RecordVerbConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
};

export type RecordVerb = {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onRun: () => void | Promise<void>;
  readonly isBusy: boolean;
  readonly blockedReason: string | null;
  readonly confirm: RecordVerbConfirm | null;
};

export type RecordSecondaryVerbs =
  readonly [] | readonly [RecordVerb] | readonly [RecordVerb, RecordVerb];

export type RecordVerbs = {
  readonly secondary: RecordSecondaryVerbs;
  readonly overflow: ReadonlyArray<RecordVerb>;
  readonly destructive: ReadonlyArray<RecordVerb>;
};

export type RecordFrame = {
  readonly primary: ReactNode;
  readonly sessionVerbs: ReadonlyArray<RecordVerb>;
  readonly onRefresh: (() => void) | null;
  readonly onClose: (() => void) | null;
};

export const NO_RECORD_VERBS: RecordVerbs = { secondary: [], overflow: [], destructive: [] };
