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

  const load = () => {
    const requestId = request.current + 1;
    request.current = requestId;
    setSelected(new Set());
    setImportError(null);
    setLoads(Object.fromEntries(sources.map((workspace) => [workspace.id, LOADING])));
    for (const workspace of sources) {
      void invokeWorkflowList(workspace.id)
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
          if (request.current !== requestId) {
            return;
          }
          setLoads((current) => ({ ...current, [workspace.id]: next }));
        });
    }
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
    toggle,
    clear,
    importSelected,
  };
};
