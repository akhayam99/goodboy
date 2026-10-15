import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

type Params = {
  readonly sessionId: SessionId;
};

export const useAutoTreeViews = ({ sessionId }: Params): ReadonlyArray<AutoTreeView> =>
  useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_VIEWS);
