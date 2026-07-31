import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { MAX_SESSION_TITLE_LENGTH } from '../../../../store/slices/sessions/titleLimit';

type Params = {
  readonly sessionId: SessionId;
  readonly currentTitle: string;
};

export const useSessionTitleRename = ({ sessionId, currentTitle }: Params) => {
  const renameTask = useAppStore((s) => s.renameTask);

  return useInlineRename({
    value: currentTitle,
    maxLength: MAX_SESSION_TITLE_LENGTH,
    onCommit: (next) => renameTask(sessionId, next),
  });
};
