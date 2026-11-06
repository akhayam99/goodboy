import type { Tone } from '@goodboy/ui';
import type { BranchTab } from '../../../../store/slices/navigation/types';

export type StatusTarget = BranchTab | 'merge';

type StatusCellId = 'checks' | 'review' | 'merge' | 'branch' | 'local' | 'request' | 'remote';

export type StatusCell = {
  readonly id: StatusCellId;
  readonly label: string;
  readonly word: string;
  readonly detail: string | null;
  readonly tone: Tone;
  readonly opens: StatusTarget | null;
  readonly isPending?: boolean;
};
