import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatError } from '@goodboy/ui';

type Params = {
  readonly value: string;
  readonly onCommit?: ((next: string) => void | Promise<void>) | null;
};

type Result = {
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly isDirty: boolean;
  readonly canEdit: boolean;
  readonly draft: string;
  readonly error: string | null;
  readonly setDraft: (next: string) => void;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly commit: () => Promise<void>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export const useInlineProseEdit = ({ value, onCommit }: Params): Result => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const committed = useRef(value);
  const canEdit = onCommit != null;

  useEffect(() => {
    if (value === committed.current) {
      return;
    }
    committed.current = value;
    setDraft(value);
    setIsDirty(false);
    setError(null);
  }, [value]);

  const updateDraft = (next: string) => {
    setDraft(next);
    setIsDirty(next !== committed.current);
    setError(null);
  };

  const start = () => {
    if (!canEdit) {
      return;
    }
    setIsEditing(true);
  };

  const cancel = () => {
    setIsEditing(false);
  };

  const commit = async () => {
    if (onCommit == null || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onCommit(draft);
      committed.current = draft;
      setIsDirty(false);
      setIsEditing(false);
      setError(null);
    } catch (commitError) {
      setError(formatError(commitError));
    } finally {
      setIsSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commit();
    }
  };

  return {
    isEditing,
    isSaving,
    isDirty,
    canEdit,
    draft,
    error,
    setDraft: updateDraft,
    start,
    cancel,
    commit,
    onKeyDown,
  };
};
