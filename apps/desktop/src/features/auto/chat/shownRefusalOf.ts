import { isAutoMountedCode } from '@goodboy/core/auto';
import type { AutoPendingRefusal, AutoTreeView } from '../../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
};

export const shownRefusalOf = ({ view }: Params): AutoPendingRefusal | null => {
  const refusal = view.pendingRefusal;
  if (refusal === null || isAutoMountedCode({ code: refusal.code })) {
    return null;
  }
  return refusal;
};
