import { useMemo, useRef, useState } from 'react';
import type { ProjectId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { isImportableWorkflow } from '../../../isImportableWorkflow';
import { invokeWorkflowList } from '../../../workflows';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly onImported: (workflow: Workflow) => void;
};

export const useWorkflowImport = ({ workspaceId, onImported }: Params) => {
  const projects = useAppStore((state) => state.projects);
  const workspaces = useAppStore((state) => state.workspaces);
  const copyWorkflowFromWorkspace = useAppStore((state) => state.copyWorkflowFromWorkspace);
  const [sourceProjectId, setSourceProjectId] = useState<ProjectId | null>(null);
  const [sourceWorkflows, setSourceWorkflows] = useState<ReadonlyArray<Workflow>>([]);
  const [sourceWorkflowId, setSourceWorkflowId] = useState<WorkflowId | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sourceLoadError, setSourceLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const sourceLoadRequest = useRef(0);
  const sourceProjects = useMemo(
    () => projects.filter((project) => project.workspaceId !== workspaceId),
    [projects, workspaceId],
  );

  const selectSourceProject = async (projectId: ProjectId) => {
    const project = sourceProjects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      return;
    }
    const requestId = sourceLoadRequest.current + 1;
    sourceLoadRequest.current = requestId;
    setSourceProjectId(project.id);
    setSourceWorkflowId(null);
    setSourceWorkflows([]);
    setSourceLoadError(null);
    setImportError(null);
    setIsLoadingSource(true);
    try {
      const loaded = await invokeWorkflowList(project.workspaceId);
      if (sourceLoadRequest.current !== requestId) {
        return;
      }
      setSourceWorkflows(loaded.filter(isImportableWorkflow));
    } catch (error) {
      if (sourceLoadRequest.current !== requestId) {
        return;
      }
      setSourceLoadError(formatError(error));
    } finally {
      if (sourceLoadRequest.current === requestId) {
        setIsLoadingSource(false);
      }
    }
  };

  const importSelected = async () => {
    const sourceProject = sourceProjects.find((project) => project.id === sourceProjectId);
    if (sourceProject === undefined || sourceWorkflowId === null) {
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      const saved = await copyWorkflowFromWorkspace({
        sourceWorkspaceId: sourceProject.workspaceId,
        sourceWorkflowId,
        targetWorkspaceId: workspaceId,
      });
      onImported(saved);
    } catch (error) {
      setImportError(formatError(error));
    } finally {
      setIsImporting(false);
    }
  };

  return {
    sourceProjects,
    workspaces,
    sourceProjectId,
    sourceWorkflows,
    sourceWorkflowId,
    isLoadingSource,
    isImporting,
    sourceLoadError,
    importError,
    selectSourceProject,
    setSourceWorkflowId,
    importSelected,
  };
};
