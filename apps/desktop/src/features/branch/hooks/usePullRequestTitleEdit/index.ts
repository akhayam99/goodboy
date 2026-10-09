import { useCallback, useEffect, useState } from 'react';
import { formatError, useEscapeLayer } from '@goodboy/ui';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { useAppStore } from '../../../../store';
import { PR_EDIT_DETAILS_EVENT, pullRequestEventName } from '../../../actions/kinds/pullRequest';

type Params = {
  readonly sessionId: SessionId;
  readonly pr: PullRequestState | null;
  readonly canEdit: boolean;
  readonly isKeyActive: boolean;
  readonly onSaved: () => void;
};

export type PullRequestTitleEdit = {
  readonly canEdit: boolean;
  readonly isEditing: boolean;
  readonly isBusy: boolean;
  readonly draft: string;
  readonly error: string | null;
  readonly setDraft: (value: string) => void;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly save: () => void;
};

export const usePullRequestTitleEdit = ({
  sessionId,
  pr,
  canEdit,
  isKeyActive,
  onSaved,
}: Params): PullRequestTitleEdit => {
  const editPr = useAppStore((state) => state.editPr);
  const notePullRequestEdit = useAppStore((state) => state.notePullRequestEdit);
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const number = pr?.number ?? null;
  const title = pr?.title ?? '';
  const isAllowed = canEdit && number !== null;

  const start = useCallback(() => {
    if (!isAllowed) {
      return;
    }
    setDraft(title);
    setError(null);
    setIsEditing(true);
  }, [isAllowed, title]);

  const cancel = useCallback(() => {
    if (isBusy) {
      return;
    }
    setIsEditing(false);
    setError(null);
  }, [isBusy]);

  const save = useCallback(() => {
    const next = draft.trim();
    if (number === null || isBusy || next === '') {
      return;
    }
    if (next === title) {
      setIsEditing(false);
      setError(null);
      return;
    }
    setIsBusy(true);
    setError(null);
    void (async () => {
      try {
        await editPr(sessionId, number, { title: next, isQuiet: true });
        notePullRequestEdit({ sessionId, prNumber: number, what: 'title' });
        setIsEditing(false);
        onSaved();
      } catch (caught) {
        setError(formatError(caught));
      } finally {
        setIsBusy(false);
      }
    })();
  }, [draft, editPr, isBusy, notePullRequestEdit, number, onSaved, sessionId, title]);

  useEffect(() => {
    setIsEditing(false);
    setError(null);
  }, [number]);

  useEffect(() => {
    if (!isAllowed) {
      return;
    }
    const name = pullRequestEventName({ name: PR_EDIT_DETAILS_EVENT, sessionId });
    window.addEventListener(name, start);
    return () => window.removeEventListener(name, start);
  }, [isAllowed, sessionId, start]);

  useShortcut('pullRequest.edit', start, isKeyActive && isAllowed && !isEditing);
  useEscapeLayer(cancel, isEditing);

  return { canEdit: isAllowed, isEditing, isBusy, draft, error, setDraft, start, cancel, save };
};
