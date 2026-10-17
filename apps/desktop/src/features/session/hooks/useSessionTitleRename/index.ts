import { SESSION_TITLE_MAX_LENGTH, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import type { SessionRowTitle } from '../../sessionTitle';

type Params = SessionRowTitle & {
  readonly sessionId: SessionId;
  readonly goal: string;
};

export const useSessionTitleRename = ({ sessionId, goal, keys, title }: Params) => {
  const renameTask = useAppStore((s) => s.renameTask);
  const hasKeys = keys.length > 0;
  const prefix = hasKeys ? goal.slice(0, goal.length - title.length) : '';
  const maxLength = SESSION_TITLE_MAX_LENGTH - prefix.length;

  const rename = useInlineRename({
    value: hasKeys ? title : goal,
    maxLength,
    onCommit: (next) => renameTask(sessionId, `${prefix}${next}`),
  });

  return {
    ...rename,
    maxLength,
    limit: SESSION_TITLE_MAX_LENGTH,
    used: prefix.length + rename.draft.length,
  };
};
