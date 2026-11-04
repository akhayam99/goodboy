import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { mountCardOf } from './mountCardOf';

type Params = {
  readonly view: AutoTreeView;
};

export const mountedLineOf = ({ view }: Params): string | null => {
  const note = view.pendingRefusal?.mount;
  if (note === undefined || note.state !== 'done') {
    return null;
  }
  return mountCardOf({ project: note.project, branch: note.branch, baseBranch: null }).doneLine;
};
