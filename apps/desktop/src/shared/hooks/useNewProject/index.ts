import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { CommandError } from '../../lib/invokeCommand';
import { homeFolder } from '../../lib/homeFolder';
import { usePickFolder } from '../usePickFolder';
import { SETTING_NEW_PROJECT_PARENT } from '../../../features/settings/settings';
import { joinPath, projectNameProblem } from '../../lib/projectName';

type Params = {
  readonly onCreated?: () => void;
};

export type NewProjectModel = {
  readonly name: string;
  readonly setName: (name: string) => void;
  readonly parent: string | null;
  readonly changeParent: () => Promise<void>;
  readonly folderPreview: string | null;
  readonly nameProblem: string | null;
  readonly canSubmit: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly existingPath: string | null;
  readonly submit: () => Promise<void>;
  readonly openExisting: () => Promise<void>;
};

export const useNewProject = ({ onCreated }: Params = {}): NewProjectModel => {
  const createNewProject = useAppStore((state) => state.createNewProject);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const ensureFirstLapSession = useAppStore((state) => state.ensureFirstLapSession);
  const navigate = useAppStore((state) => state.navigate);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const savedParent = useAppStore((state) => state.settings[SETTING_NEW_PROJECT_PARENT] ?? null);
  const pickFolder = usePickFolder();
  const [name, setName] = useState('');
  const [chosenParent, setChosenParent] = useState<string | null>(null);
  const [homeParent, setHomeParent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPath, setExistingPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void homeFolder().then((found) => {
      if (!cancelled) {
        setHomeParent(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const parent = chosenParent ?? savedParent ?? homeParent;
  const trimmed = name.trim();
  const nameProblem = projectNameProblem(name);
  const canSubmit = !busy && parent !== null && trimmed !== '' && nameProblem === null;
  const folderPreview =
    parent === null ? null : joinPath({ parent, name: trimmed === '' ? 'your-project' : trimmed });

  const updateName = useCallback((next: string) => {
    setName(next);
    setError(null);
    setExistingPath(null);
  }, []);

  const changeParent = useCallback(async () => {
    const picked = await pickFolder();
    if (picked !== null) {
      setChosenParent(picked);
      setError(null);
      setExistingPath(null);
    }
  }, [pickFolder]);

  const openAndStart = useCallback(
    async ({
      workspaceId,
      title,
    }: {
      readonly workspaceId: Parameters<typeof openWorkspace>[0]['id'];
      readonly title: string;
    }) => {
      await openWorkspace({ id: workspaceId, title, onRunning: 'new-window' });
    },
    [openWorkspace],
  );

  const submit = useCallback(async () => {
    if (!canSubmit || parent === null) {
      return;
    }
    setBusy(true);
    setError(null);
    setExistingPath(null);
    try {
      const created = await createNewProject({ parentPath: parent, name: trimmed });
      await saveSetting(SETTING_NEW_PROJECT_PARENT, parent);
      await openAndStart({ workspaceId: created.workspace.id, title: created.workspace.name });
      onCreated?.();
      try {
        const session = await ensureFirstLapSession({ projectId: created.project.id });
        navigate({ to: sessionPlace({ sessionId: session.id }) });
      } catch (startError) {
        setError(`The project is ready. ${formatError(startError)}`);
      }
    } catch (failure) {
      if (failure instanceof CommandError && failure.kind === 'already_exists') {
        setExistingPath(joinPath({ parent, name: trimmed }));
        setError(`A folder named ${trimmed} already exists here`);
        return;
      }
      setError(formatError(failure));
    } finally {
      setBusy(false);
    }
  }, [
    canSubmit,
    parent,
    trimmed,
    createNewProject,
    saveSetting,
    openAndStart,
    onCreated,
    ensureFirstLapSession,
    navigate,
  ]);

  const openExisting = useCallback(async () => {
    if (existingPath === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const workspace = await addWorkspace({ rootPath: existingPath });
      await openAndStart({ workspaceId: workspace.id, title: workspace.name });
      onCreated?.();
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setBusy(false);
    }
  }, [existingPath, addWorkspace, openAndStart, onCreated]);

  return {
    name,
    setName: updateName,
    parent,
    changeParent,
    folderPreview,
    nameProblem,
    canSubmit,
    busy,
    error,
    existingPath,
    submit,
    openExisting,
  };
};
