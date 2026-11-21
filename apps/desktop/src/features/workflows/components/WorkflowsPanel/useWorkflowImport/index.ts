import { useMemo, useRef, useState } from 'react';
import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import type { WorkflowImportPick } from '../../../../../store/slices/workflows/copyWorkflowsFromWorkspaces';
import { isImportableWorkflow } from '../../../isImportableWorkflow';
import { invokeWorkflowList } from '../../../workflows';

export type ImportGroup = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly projectNames: ReadonlyArray<string>;
  readonly status: 'loading' | 'ready' | 'failed';
  readonly workflows: ReadonlyArray<Workflow>;
  readonly error: string | null;
};

type LoadState = Pick<ImportGroup, 'status' | 'workflows' | 'error'>;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type FetchParams = {
  readonly workspaceId: WorkspaceId;
};

const LOADING: LoadState = { status: 'loading', workflows: [], error: null };

export const useWorkflowImport = ({ workspaceId }: Params) => {
  const projects = useAppStore((state) => state.projects);
  const workspaces = useAppStore((state) => state.workspaces);
  const copyWorkflowsFromWorkspaces = useAppStore((state) => state.copyWorkflowsFromWorkspaces);
  const [loads, setLoads] = useState<Readonly<Record<string, LoadState>>>({});
  const [selected, setSelected] = useState<ReadonlySet<WorkflowId>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const request = useRef(0);
  const workspaceTokens = useRef<Record<string, number>>({});

  const sources = useMemo(
    () => workspaces.filter((workspace) => workspace.id !== workspaceId),
    [workspaceId, workspaces],
  );

  const groups = useMemo<ReadonlyArray<ImportGroup>>(
    () =>
      sources.map((workspace) => ({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        projectNames: projects
          .filter((project) => project.workspaceId === workspace.id)
          .map((project) => project.name),
        ...(loads[workspace.id] ?? LOADING),
      })),
    [loads, projects, sources],
  );

  const fetchWorkspace = ({ workspaceId: sourceId }: FetchParams) => {
    const generation = request.current;
    const token = (workspaceTokens.current[sourceId] ?? 0) + 1;
    workspaceTokens.current[sourceId] = token;
    setLoads((current) => ({ ...current, [sourceId]: LOADING }));
    void invokeWorkflowList(sourceId)
      .then((loaded): LoadState => ({
        status: 'ready',
        workflows: loaded.filter(isImportableWorkflow),
        error: null,
      }))
      .catch((error: unknown): LoadState => ({
        status: 'failed',
        workflows: [],
        error: formatError(error),
      }))
      .then((next) => {
        if (request.current !== generation || workspaceTokens.current[sourceId] !== token) {
          return;
        }
        setLoads((current) => ({ ...current, [sourceId]: next }));
      });
  };

  const load = () => {
    request.current += 1;
    setSelected(new Set());
    setImportError(null);
    for (const workspace of sources) {
      fetchWorkspace({ workspaceId: workspace.id });
    }
  };

  const retry = ({ workspaceId: sourceId }: FetchParams) => {
    setImportError(null);
    fetchWorkspace({ workspaceId: sourceId });
  };

  const toggle = (id: WorkflowId) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());

  const picks = groups.flatMap((group) =>
    group.workflows
      .filter((workflow) => selected.has(workflow.id))
      .map((workflow): WorkflowImportPick => ({
        workflow,
        sourceWorkspaceName: group.workspaceName,
      })),
  );

  const importSelected = async (): Promise<ReadonlyArray<WorkflowImportPick> | null> => {
    if (picks.length === 0 || isImporting) {
      return null;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      await copyWorkflowsFromWorkspaces({ picks, targetWorkspaceId: workspaceId });
      setSelected(new Set());
      return picks;
    } catch (error) {
      setImportError(formatError(error));
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  return {
    groups,
    selected,
    picks,
    isImporting,
    importError,
    load,
    retry,
    toggle,
    clear,
    importSelected,
  };
};
