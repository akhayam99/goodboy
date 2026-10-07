import { useCallback, useState } from 'react';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useCopyText } from '../../../../../shared/hooks/useCopyText';
import { parsePlanSource, planToSource } from '../../../../plans/planSource';

const PLAN_TITLE_MISSING = 'The first line is the plan title. Add one before saving.';

const SAVE_FAILED_TITLE = "Couldn't save the plan";

const SAVE_FAILED_INLINE = "Couldn't save the plan. Your text is still here.";

type Params = Readonly<{
  sessionId: SessionId;
  plan: PlanWithCount | null;
  revision: number;
  onSaved?: (params: { readonly revision: number }) => void;
}>;

type Session = Readonly<{
  initial: string;
  draft: string;
  startRevision: number;
}>;

type Conflict = Readonly<{ revision: number }>;

export type PlanEditorModel = Readonly<{
  isEditing: boolean;
  draft: string;
  isDirty: boolean;
  isSaving: boolean;
  canSave: boolean;
  error: string | null;
  conflict: Conflict | null;
  isDiscardAsked: boolean;
  start: () => void;
  change: (params: { readonly text: string }) => void;
  save: () => Promise<void>;
  leave: () => void;
  escape: () => void;
  discard: () => void;
  keepEditing: () => void;
  copyDraft: () => Promise<void>;
}>;

export const usePlanEditor = ({ sessionId, plan, revision, onSaved }: Params): PlanEditorModel => {
  const updatePlanBody = useAppStore((state) => state.updatePlanBody);
  const reportError = useAppStore((state) => state.reportError);
  const copyText = useCopyText();
  const [session, setSession] = useState<Session | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [isDiscardAsked, setIsDiscardAsked] = useState(false);

  const clear = useCallback(() => {
    setSession(null);
    setError(null);
    setConflict(null);
    setIsDiscardAsked(false);
  }, []);

  const start = useCallback(() => {
    if (plan === null) {
      return;
    }
    const source = planToSource(plan);
    setError(null);
    setConflict(null);
    setIsDiscardAsked(false);
    setSession({ initial: source, draft: source, startRevision: revision });
  }, [plan, revision]);

  const change = useCallback(({ text }: { readonly text: string }) => {
    setSession((current) => (current === null ? current : { ...current, draft: text }));
  }, []);

  const save = useCallback(async () => {
    if (plan === null || session === null || isSaving || conflict !== null) {
      return;
    }
    setError(null);
    const parsed = parsePlanSource({ source: session.draft });
    if (parsed.title.length === 0) {
      setError(PLAN_TITLE_MISSING);
      return;
    }
    if (parsed.title === plan.title && parsed.bodyMd === plan.bodyMd) {
      clear();
      return;
    }
    setIsSaving(true);
    try {
      const result = await updatePlanBody(
        sessionId,
        plan.id,
        parsed.title,
        parsed.bodyMd,
        session.startRevision,
      );
      if (result.kind === 'conflict') {
        setConflict({ revision: result.revision });
        return;
      }
      clear();
      onSaved?.({ revision: result.revision });
    } catch (cause) {
      setError(SAVE_FAILED_INLINE);
      await reportError({ title: SAVE_FAILED_TITLE, error: cause, sessionId });
    } finally {
      setIsSaving(false);
    }
  }, [clear, conflict, isSaving, onSaved, plan, reportError, session, sessionId, updatePlanBody]);

  const isDirty = session !== null && session.draft !== session.initial;

  const leave = useCallback(() => {
    if (session === null) {
      return;
    }
    if (isDirty) {
      setIsDiscardAsked(true);
      return;
    }
    clear();
  }, [clear, isDirty, session]);

  const keepEditing = useCallback(() => setIsDiscardAsked(false), []);

  const escape = useCallback(() => {
    if (isDiscardAsked) {
      setIsDiscardAsked(false);
      return;
    }
    leave();
  }, [isDiscardAsked, leave]);

  const copyDraft = useCallback(async () => {
    if (session !== null) {
      await copyText({ text: session.draft });
    }
  }, [copyText, session]);

  return {
    isEditing: session !== null,
    draft: session?.draft ?? '',
    isDirty,
    isSaving,
    canSave: conflict === null,
    error,
    conflict,
    isDiscardAsked,
    start,
    change,
    save,
    leave,
    escape,
    discard: clear,
    keepEditing,
    copyDraft,
  };
};
