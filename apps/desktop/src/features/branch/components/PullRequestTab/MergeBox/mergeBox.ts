import type { Tone } from '@goodboy/ui';
import type { BranchTab } from '../../../../../store/slices/navigation/types';

export type MergeBoxTarget = BranchTab | 'reviewers';

export type MergeBoxRowId = 'checks' | 'review' | 'comments' | 'conflicts' | 'unpushed' | 'branch';

export type MergeBoxGlyph =
  | 'failing'
  | 'running'
  | 'unknown'
  | 'changes'
  | 'waiting'
  | 'ask'
  | 'comments'
  | 'conflicts'
  | 'push'
  | 'behind'
  | 'rebasing'
  | 'diverged';

export type MergeBoxRow = {
  readonly id: MergeBoxRowId;
  readonly glyph: MergeBoxGlyph;
  readonly title: string;
  readonly detail: string | null;
  readonly tone: Tone;
  readonly opens: MergeBoxTarget | null;
};

export type MergeBoxVerdictKind =
  'blocked' | 'waiting' | 'checking' | 'ready' | 'draft' | 'queued' | 'merged' | 'closed';

export type MergeBoxVerdict = {
  readonly kind: MergeBoxVerdictKind;
  readonly word: string;
  readonly line: string | null;
  readonly tone: Tone;
};

export type MergeBox = {
  readonly verdict: MergeBoxVerdict;
  readonly rows: ReadonlyArray<MergeBoxRow>;
  readonly passing: ReadonlyArray<string>;
};
