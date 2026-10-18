import { useCallback, useRef, useState } from 'react';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import type { ReconnectCandidate } from '../../../../store/slices/workspaces/checkReconnectCandidate';
import { usePickFolder } from '../../../hooks/usePickFolder';
import { useNewProject, type NewProjectModel } from '../../../hooks/useNewProject';
import { SETTING_NEW_PROJECT_PARENT } from '../../../../features/settings/settings';
import { nameFromFolder } from '../../../../features/workspace/nameFromFolder';
import { folderName } from '../../../../store/slices/terminal/terminalOwner';
import { createBlock } from '../createBlock';
import { createRequest } from '../createRequest';
import { draftFolders } from '../draftFolders';
import type { FolderEntry, FoundSummary, MoveChoice } from '../folderEntry';
import type { NewWorkspaceMode } from '../newWorkspaceMode';
import { readFolder } from '../readFolder';

type DraftStage = 'empty' | 'folders' | 'scratch';

export type DraftStart = 'folder' | 'scratch';

export type DraftReconnect = {
  readonly rootPath: string;
  readonly candidate: ReconnectCandidate;
};

type DraftState = {
  readonly stage: DraftStage;
  readonly folders: ReadonlyArray<FolderEntry>;
  readonly sourcePath: string | null;
  readonly found: FoundSummary | null;
  readonly reconnect: DraftReconnect | null;
};

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

type Params = {
  readonly mode: NewWorkspaceMode;
  readonly workspaceId?: WorkspaceId;
  readonly start?: DraftStart;
  readonly onCreated?: (params: CreatedParams) => void;
};

type PathParams = {
  readonly path: string;
};

type ReadParams = {
  readonly path: string;
  readonly replaces: number | 'all' | null;
};

type PickParams = {
  readonly pick: number;
};

type ChoiceParams = {
  readonly path: string;
  readonly choice: MoveChoice;
};

type GitInitParams = {
  readonly path: string;
  readonly isGitInit: boolean;
};

type FirstLapParams = {
  readonly projectId: ProjectId;
};

type DropParams = {
  readonly paths: ReadonlyArray<string>;
};

export type WorkspaceDraft = {
  readonly workspaceId: WorkspaceId;
  readonly stage: DraftStage;
  readonly folders: ReadonlyArray<FolderEntry>;
  readonly found: FoundSummary | null;
  readonly reconnectOffer: DraftReconnect | null;
  readonly sourceName: string | null;
  readonly name: string;
  readonly setName: (name: string) => void;
  readonly folderCount: number;
  readonly block: string | null;
  readonly readingPath: string | null;
  readonly isCreating: boolean;
  readonly error: string | null;
  readonly scratch: NewProjectModel;
  readonly choose: () => Promise<void>;
  readonly drop: (params: DropParams) => Promise<void>;
  readonly addFolder: () => Promise<void>;
  readonly retry: (params: PickParams & PathParams) => Promise<void>;
  readonly chooseAnother: (params: PickParams) => Promise<void>;
  readonly remove: (params: PathParams) => void;
  readonly toggle: (params: PathParams) => void;
  readonly setGitInit: (params: GitInitParams) => void;
  readonly decide: (params: ChoiceParams) => void;
  readonly leave: (params: PathParams) => void;
  readonly startScratch: () => void;
  readonly backToEmpty: () => void;
  readonly create: () => Promise<void>;
  readonly reconnect: () => Promise<void>;
  readonly dismissReconnect: () => void;
};

const EMPTY: DraftState = {
  stage: 'empty',
  folders: [],
  sourcePath: null,
  found: null,
  reconnect: null,
};

const newWorkspaceId = (): WorkspaceId => brandId<WorkspaceId>({ value: crypto.randomUUID() });

type MergeParams = {
  readonly current: ReadonlyArray<FolderEntry>;
  readonly incoming: ReadonlyArray<FolderEntry>;
  readonly replaces: number | 'all' | null;
};

const mergeFolders = ({ current, incoming, replaces }: MergeParams): ReadonlyArray<FolderEntry> => {
  if (replaces === 'all') {
    return incoming;
  }
  const kept = current.filter((folder) => folder.pick !== replaces);
  const known = new Set(kept.map((folder) => folder.path));
  return [...kept, ...incoming.filter((folder) => !known.has(folder.path))];
};

type UpdateParams = {
  readonly folders: ReadonlyArray<FolderEntry>;
  readonly path: string;
  readonly change: (folder: FolderEntry) => FolderEntry;
};

const updateFolder = ({ folders, path, change }: UpdateParams): ReadonlyArray<FolderEntry> =>
  folders.map((folder) => (folder.path === path ? change(folder) : folder));

export const useWorkspaceDraft = ({
  mode,
  workspaceId: targetWorkspaceId,
  start = 'folder',
  onCreated,
}: Params): WorkspaceDraft => {
  const createWorkspaceWithFolders = useAppStore((state) => state.createWorkspaceWithFolders);
  const previewProjectAdoption = useAppStore((state) => state.previewProjectAdoption);
  const checkReconnectCandidate = useAppStore((state) => state.checkReconnectCandidate);
  const reconnectMovedProject = useAppStore((state) => state.reconnectMovedProject);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const ensureFirstLapSession = useAppStore((state) => state.ensureFirstLapSession);
  const navigate = useAppStore((state) => state.navigate);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const targetName = useAppStore((state) =>
    targetWorkspaceId === undefined
      ? null
      : (state.workspaces.find((workspace) => workspace.id === targetWorkspaceId)?.name ?? null),
  );
  const pickFolder = usePickFolder();
  const scratch = useNewProject();
  const [draftWorkspaceId] = useState(newWorkspaceId);
  const workspaceId = targetWorkspaceId ?? draftWorkspaceId;
  const [draft, setDraft] = useState<DraftState>(() =>
    start === 'scratch' ? { ...EMPTY, stage: 'scratch' } : EMPTY,
  );
  const [editedName, setEditedName] = useState<string | null>(null);
  const [readingPath, setReadingPath] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef(0);

  const isScratch = draft.stage === 'scratch';
  const isAdding = mode === 'add';
  const derivedName = isScratch
    ? scratch.folderPath === null
      ? ''
      : nameFromFolder({ path: scratch.folderPath })
    : draft.sourcePath === null
      ? ''
      : nameFromFolder({ path: draft.sourcePath });
  const name = isAdding
    ? (targetName ?? '')
    : isScratch
      ? derivedName
      : (editedName ?? derivedName);
  const folderCount = draftFolders({ folders: draft.folders }).length;
  const scratchBlock = scratch.isUsable ? null : 'Name the new folder.';
  const block = isScratch
    ? scratchBlock
    : createBlock({ folders: draft.folders, name: isAdding ? null : name });

  const invalidate = () => {
    pickRef.current += 1;
    setReadingPath(null);
  };

  const read = async ({ path, replaces }: ReadParams) => {
    pickRef.current += 1;
    const pick = pickRef.current;
    setReadingPath(path);
    setError(null);
    try {
      const reading = await readFolder({
        path,
        pick,
        workspaceId,
        preview: previewProjectAdoption,
      });
      const single = reading.entries.length === 1 ? reading.entries[0] : undefined;
      const candidate =
        isAdding || replaces !== 'all' || single === undefined || single.kind === 'unreadable'
          ? null
          : await checkReconnectCandidate({ rootPath: single.path });
      if (pick !== pickRef.current) {
        return;
      }
      setDraft((current) => ({
        stage: 'folders',
        folders: mergeFolders({ current: current.folders, incoming: reading.entries, replaces }),
        sourcePath: replaces === 'all' ? reading.sourcePath : current.sourcePath,
        found: replaces === 'all' ? reading.found : current.found,
        reconnect:
          candidate === null || single === undefined
            ? replaces === 'all'
              ? null
              : current.reconnect
            : { rootPath: single.path, candidate },
      }));
    } catch (cause) {
      if (pick === pickRef.current) {
        setError(formatError(cause));
      }
    } finally {
      if (pick === pickRef.current) {
        setReadingPath(null);
      }
    }
  };

  const choose = async () => {
    const picked = await pickFolder();
    if (picked !== null) {
      await read({ path: picked, replaces: 'all' });
    }
  };

  const drop = async ({ paths }: DropParams) => {
    for (const [index, path] of paths.entries()) {
      await read({
        path,
        replaces: index === 0 && draft.stage !== 'folders' ? 'all' : null,
      });
    }
  };

  const addFolder = async () => {
    const picked = await pickFolder();
    if (picked !== null) {
      await read({ path: picked, replaces: null });
    }
  };

  const replacementOf = ({ pick }: PickParams): number | 'all' =>
    draft.folders.every((folder) => folder.pick === pick) ? 'all' : pick;

  const retry = async ({ pick, path }: PickParams & PathParams) => {
    await read({ path, replaces: replacementOf({ pick }) });
  };

  const chooseAnother = async ({ pick }: PickParams) => {
    const picked = await pickFolder();
    if (picked !== null) {
      await read({ path: picked, replaces: replacementOf({ pick }) });
    }
  };

  const remove = ({ path }: PathParams) => {
    invalidate();
    setDraft((current) => {
      const folders = current.folders.filter((folder) => folder.path !== path);
      return folders.length === 0 ? EMPTY : { ...current, folders };
    });
  };

  const toggle = ({ path }: PathParams) =>
    setDraft((current) => ({
      ...current,
      folders: updateFolder({
        folders: current.folders,
        path,
        change: (folder) => ({ ...folder, isIncluded: !folder.isIncluded }),
      }),
    }));

  const setGitInit = ({ path, isGitInit }: GitInitParams) =>
    setDraft((current) => ({
      ...current,
      folders: updateFolder({
        folders: current.folders,
        path,
        change: (folder) => (folder.kind === 'plain' ? { ...folder, isGitInit } : folder),
      }),
    }));

  const decide = ({ path, choice }: ChoiceParams) =>
    setDraft((current) => ({
      ...current,
      folders: updateFolder({
        folders: current.folders,
        path,
        change: (folder) =>
          folder.kind === 'unreadable' || folder.conflict === null
            ? folder
            : { ...folder, conflict: { ...folder.conflict, choice } },
      }),
    }));

  const startScratch = () => {
    invalidate();
    setError(null);
    setDraft({ ...EMPTY, stage: 'scratch' });
  };

  const backToEmpty = () => {
    invalidate();
    setError(null);
    setDraft(EMPTY);
  };

  const startFirstLap = async ({ projectId }: FirstLapParams) => {
    try {
      const session = await ensureFirstLapSession({ projectId });
      navigate({ to: sessionPlace({ sessionId: session.id }) });
    } catch (cause) {
      await reportError({ title: 'The first session did not start', error: cause, workspaceId });
    }
  };

  const create = async () => {
    if (isCreating || block !== null) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const request =
        isScratch && scratch.parent !== null
          ? {
              folders: [
                { kind: 'scratch' as const, parentPath: scratch.parent, name: scratch.name.trim() },
              ],
              moves: [],
            }
          : createRequest({ folders: draft.folders });
      const created = await createWorkspaceWithFolders({ workspaceId, name, ...request });
      if (isScratch && scratch.parent !== null) {
        await saveSetting(SETTING_NEW_PROJECT_PARENT, scratch.parent);
      }
      if (mode === 'new') {
        await openWorkspace({
          id: created.workspace.id,
          title: created.workspace.name,
          onRunning: 'new-window',
        });
      }
      onCreated?.({ workspaceId: created.workspace.id });
      const firstProject = created.projects[0];
      if (mode === 'new' && isScratch && firstProject !== undefined) {
        await startFirstLap({ projectId: firstProject.id });
      }
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsCreating(false);
    }
  };

  const reconnect = async () => {
    const found = draft.reconnect;
    if (found === null || isCreating) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const { rootPath, candidate } = found;
      const workspace =
        candidate.moved === null
          ? await addWorkspace({ rootPath })
          : await reconnectMovedProject({
              workspaceId: candidate.workspaceId,
              projectId: candidate.moved.projectId,
              fromRoot: candidate.moved.fromRoot,
              toRoot: rootPath,
            });
      if (mode === 'new') {
        await openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
      }
      onCreated?.({ workspaceId: workspace.id });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsCreating(false);
    }
  };

  const dismissReconnect = useCallback(
    () => setDraft((current) => ({ ...current, reconnect: null })),
    [],
  );

  return {
    workspaceId,
    stage: draft.stage,
    folders: draft.folders,
    found: draft.found,
    reconnectOffer: draft.reconnect,
    sourceName: folderName({ path: draft.sourcePath }),
    name,
    setName: setEditedName,
    folderCount,
    block,
    readingPath,
    isCreating,
    error,
    scratch,
    choose,
    drop,
    addFolder,
    retry,
    chooseAnother,
    remove,
    toggle,
    setGitInit,
    decide,
    leave: remove,
    startScratch,
    backToEmpty,
    create,
    reconnect,
    dismissReconnect,
  };
};
