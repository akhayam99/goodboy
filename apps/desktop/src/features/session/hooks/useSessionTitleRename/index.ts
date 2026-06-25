import { useState, type KeyboardEvent } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { MAX_SESSION_TITLE_LENGTH } from '../../../../store/slices/sessions/titleLimit';

type Params = {
  readonly sessionId: SessionId;
  readonly currentTitle: string;
};

export const useSessionTitleRename = ({ sessionId, currentTitle }: Params) => {
  const renameTask = useAppStore((s) => s.renameTask);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setDraft(currentTitle);
    setError(null);
    setRenaming(true);
  };

  const cancel = () => {
    setRenaming(false);
    setError(null);
  };

  const commit = async () => {
    if (!draft.trim()) {
      setError('name cannot be empty');
      return;
    }
    try {
      await renameTask(sessionId, draft.trim());
      setRenaming(false);
      setError(null);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void commit();
    }
    if (e.key === 'Escape') {
      cancel();
    }
  };

  return {
    renaming,
    draft,
    error,
    maxLength: MAX_SESSION_TITLE_LENGTH,
    setDraft,
    start,
    cancel,
    commit,
    onKeyDown,
  };
};
