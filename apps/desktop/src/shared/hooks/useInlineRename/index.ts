import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatError } from '@goodboy/ui';

type Params = {
  readonly value: string;
  readonly onCommit: (next: string) => void | Promise<void>;
  readonly isEditing?: boolean;
  readonly onCancel?: () => void;
  readonly maxLength?: number;
};

export const useInlineRename = ({ value, onCommit, isEditing, onCancel, maxLength }: Params) => {
  const [selfEditing, setSelfEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const pendingRef = useRef(false);
  const editing = isEditing === undefined ? selfEditing : isEditing;

  useEffect(() => {
    if (!editing) {
      return;
    }
    setDraft(value);
  }, [editing]);

  const start = () => {
    setDraft(value);
    setError(null);
    setCanRetry(false);
    setSelfEditing(true);
  };

  const cancel = () => {
    setSelfEditing(false);
    setError(null);
    setCanRetry(false);
    onCancel?.();
  };

  const commit = async () => {
    if (pendingRef.current) {
      return;
    }
    const next = draft.trim();
    if (next === '') {
      setError('name cannot be empty');
      setCanRetry(false);
      return;
    }
    if (maxLength !== undefined && next.length > maxLength) {
      setError('name is too long');
      setCanRetry(false);
      return;
    }
    pendingRef.current = true;
    setIsPending(true);
    try {
      await onCommit(next);
      setSelfEditing(false);
      setError(null);
      setCanRetry(false);
    } catch (err) {
      setError(formatError(err));
      setCanRetry(true);
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const onBlur = () => {
    if (draft.trim() === '') {
      cancel();
      return;
    }
    void commit();
  };

  return {
    editing,
    draft,
    error,
    canRetry,
    isPending,
    maxLength,
    setDraft,
    start,
    cancel,
    commit,
    onKeyDown,
    onBlur,
  };
};
