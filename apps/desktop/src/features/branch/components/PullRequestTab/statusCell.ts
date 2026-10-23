import type { Tone } from '@goodboy/ui';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type StatusCellId = 'checks' | 'review' | 'merge' | 'branch' | 'local' | 'request' | 'remote';

export type StatusCell = {
  readonly id: StatusCellId;
  readonly label: string;
  readonly word: string;
  readonly detail: string | null;
  readonly tone: Tone;
  readonly opens: BranchTab | null;
};
