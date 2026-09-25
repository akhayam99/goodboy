import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { MountId, ProjectId, ProjectScriptId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

export type ScriptDraft = {
  readonly mountId: MountId;
  readonly savedId: ProjectScriptId | null;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly body: string;
  readonly initialName: string;
  readonly initialBody: string;
  readonly initialProjectId: ProjectId;
};

export type DraftPatch = Partial<Pick<ScriptDraft, 'name' | 'body' | 'projectId'>>;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type OpenParams = {
  readonly mountId: MountId;
  readonly savedId: ProjectScriptId | null;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly body: string;
};

type SaveOutcome = 'saved' | 'failed';

const isDirty = (draft: ScriptDraft | null): boolean =>
  draft !== null &&
  (draft.name !== draft.initialName ||
    draft.body !== draft.initialBody ||
    draft.projectId !== draft.initialProjectId);

const draftFrom = ({ mountId, savedId, projectId, name, body }: OpenParams): ScriptDraft => ({
  mountId,
  savedId,
  projectId,
  name,
  body,
  initialName: savedId === null ? '' : name,
  initialBody: savedId === null ? '' : body,
  initialProjectId: projectId,
});

export const useScriptDraft = ({ workspaceId }: Params) => {
  const saveScript = useAppStore((state) => state.saveScript);
  const [draft, setDraft] = useState<ScriptDraft | null>(null);
  const [pending, setPending] = useState<ScriptDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const open = useCallback(
    (params: OpenParams) => {
      const next = draftFrom(params);
      if (isDirty(draft)) {
        setPending(next);
        return;
      }
      setError(null);
      setDraft(next);
    },
    [draft],
  );

  const update = useCallback((patch: DraftPatch) => {
    setDraft((current) => (current === null ? null : { ...current, ...patch }));
  }, []);

  const cancel = useCallback(() => {
    setDraft(null);
    setPending(null);
    setError(null);
  }, []);

  const persist = useCallback(async (): Promise<SaveOutcome> => {
    if (draft === null) {
      return 'failed';
    }
    const name = draft.name.trim();
    const body = draft.body.trim();
    if (name === '' || body === '') {
      setError('Name and script body are required');
      return 'failed';
    }
    setError(null);
    setIsSaving(true);
    try {
      await saveScript({
        workspaceId,
        projectId: draft.projectId,
        ...(draft.savedId === null ? {} : { id: draft.savedId }),
        name,
        body,
      });
      return 'saved';
    } catch (caughtError) {
      setError(formatError(caughtError));
      return 'failed';
    } finally {
      setIsSaving(false);
    }
  }, [draft, saveScript, workspaceId]);

  const save = useCallback(() => {
    void persist().then((outcome) => {
      if (outcome === 'saved') {
        setDraft(null);
      }
    });
  }, [persist]);

  const discardAndContinue = useCallback(() => {
    setError(null);
    setDraft(pending);
    setPending(null);
  }, [pending]);

  const saveAndContinue = useCallback(() => {
    void persist().then((outcome) => {
      if (outcome === 'saved') {
        setDraft(pending);
        setPending(null);
      }
    });
  }, [pending, persist]);

  const keepEditing = useCallback(() => {
    setPending(null);
  }, []);

  return {
    draft,
    error,
    isSaving,
    hasPending: pending !== null,
    open,
    update,
    cancel,
    save,
    discardAndContinue,
    saveAndContinue,
    keepEditing,
  };
};
