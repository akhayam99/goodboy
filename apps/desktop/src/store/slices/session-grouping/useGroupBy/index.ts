import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectGroupBy } from '../selectGroupBy';
import type { GroupBy } from '../state';

type Params = {
  readonly sessionId: SessionId;
  readonly branchCount: number;
};

export const useGroupBy = ({ sessionId, branchCount }: Params): GroupBy =>
  useAppStore((state) => selectGroupBy({ state, sessionId, branchCount }));
