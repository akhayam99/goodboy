import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ResolvedFact } from '../../../detail-fields/factTypes';

type RecordVerbConfirm = {
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

export type RecordStar = {
  readonly isStarred: boolean;
  readonly onToggle: () => void;
};

export type RecordFrame = {
  readonly primary: ReactNode;
  readonly link?: ReactNode;
  readonly sessionVerbs: ReadonlyArray<RecordVerb>;
  readonly onRefresh: (() => void) | null;
  readonly onClose: (() => void) | null;
  readonly onOpenFull?: (() => void) | null;
  readonly star?: RecordStar | null;
  readonly linkFacts?: ReadonlyArray<ResolvedFact>;
};

export const NO_RECORD_VERBS: RecordVerbs = { secondary: [], overflow: [], destructive: [] };
