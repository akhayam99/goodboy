import { useEffect, useMemo, useState } from 'react';
import type { ProviderId, Workflow, WorkspaceId } from '@goodboy/types';
import { PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { primaryProjectRoot } from '../../../workspace/primaryProjectRoot';
import { WorkflowEditor } from '../WorkflowStudio/WorkflowEditor';
import { ImportPopover } from '../WorkflowStudio/ImportPopover';
import { SavedStepsList } from '../WorkflowStudio/SavedStepsList';
import { StudioHomeTabs } from '../WorkflowStudio/StudioHomeTabs';
import type { StudioHomeView } from '../../studioHomeView';
import { WorkflowList } from '../WorkflowStudio/WorkflowList';
import { WorkflowRulesPanel } from '../WorkflowRulesPanel';
import { useRemovedBuiltins } from '../../hooks/useRemovedBuiltins';
import { useSavedSteps } from '../../hooks/useSavedSteps';
import { isPresetWorkflow } from '../../isPresetWorkflow';
import { useWorkflowEditor } from './useWorkflowEditor';

type Props = { readonly workspaceId: WorkspaceId };

export const WorkflowsPanel = ({ workspaceId }: Props) => {
  const templates = useAppStore(
    (state) => state.phaseTemplates[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const providers = useAppStore((state) => state.providers);
  const workspaces = useAppStore((state) => state.workspaces);
  const workingDir = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const loadStepLibrary = useAppStore((state) => state.loadStepLibrary);
  const resetWorkflows = useAppStore((state) => state.resetWorkflows);
  const [isRestoring, setIsRestoring] = useState(false);
  const requestedView = useAppStore((state) => state.workflowStudioView);
  const setWorkflowStudioView = useAppStore((state) => state.setWorkflowStudioView);
  const [view, setView] = useState<StudioHomeView>(requestedView);
  const savedSteps = useSavedSteps({ workspaceId });

  const connectedProviders = useMemo<ReadonlyArray<ProviderId>>(
    () =>
      providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    [providers],
  );
  const presets = useMemo(() => templates.filter(isPresetWorkflow), [templates]);
  const takenNames = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        templates.filter((template) => template.deletedAt == null).map((template) => template.name),
      ),
    [templates],
  );
  const workspaceName = workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null;
  const editor = useWorkflowEditor({ workspaceId, presets, workingDir });
  const focusedWorkflowId = useAppStore((state) => state.workflowStudioFocus);
  const setWorkflowStudioFocus = useAppStore((state) => state.setWorkflowStudioFocus);
  const openEditor = editor.open;

  useEffect(() => {
    const focused = templates.find((template) => template.id === focusedWorkflowId);
    if (focused === undefined) {
      return;
    }
    setWorkflowStudioFocus({ workflowId: null });
    openEditor(focused);
  }, [focusedWorkflowId, templates, openEditor, setWorkflowStudioFocus]);

  useEffect(() => () => setWorkflowStudioFocus({ workflowId: null }), [setWorkflowStudioFocus]);
  useEffect(() => {
    if (requestedView === 'workflows') {
      return;
    }
    setView(requestedView);
    setWorkflowStudioView('workflows');
  }, [requestedView, setWorkflowStudioView]);
  const removedBuiltinIds = useRemovedBuiltins({ workspaceId, workflows: templates });

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
    void loadStepLibrary(workspaceId);
  }, [loadPhaseTemplates, loadStepLibrary, workspaceId]);

  const restore = async (slugs: ReadonlyArray<string>) => {
    setIsRestoring(true);
    try {
      await resetWorkflows({ workspaceId, slugs });
    } finally {
      setIsRestoring(false);
    }
  };

  const tabs = (
    <StudioHomeTabs
      value={view}
      workflowCount={presets.length}
      stepCount={savedSteps.builtin.length + savedSteps.workspace.length}
      onChange={setView}
    />
  );

  return (
    <ScrollFade className="min-h-0 w-full flex-1">
      <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.body, 'flex flex-col')}>
        {editor.editing !== null ? null : view === 'rules' ? (
          <div className="flex min-w-0 flex-col gap-4">
            {tabs}
            <WorkflowRulesPanel workspaceId={workspaceId} />
          </div>
        ) : view === 'steps' ? (
          <SavedStepsList
            workspaceId={workspaceId}
            connectedProviders={connectedProviders}
            tabs={tabs}
          />
        ) : (
          <WorkflowList
            workflows={presets}
            removedBuiltinIds={removedBuiltinIds}
            workspaceName={workspaceName}
            isRestoring={isRestoring}
            tabs={tabs}
            importControl={<ImportPopover workspaceId={workspaceId} takenNames={takenNames} />}
            onOpen={editor.open}
            onNew={editor.openNew}
            onRestore={restore}
          />
        )}
        {editor.editing === null ? null : (
          <WorkflowEditor
            workspaceId={workspaceId}
            workingDir={workingDir}
            connectedProviders={connectedProviders}
            editor={editor}
          />
        )}
      </div>
    </ScrollFade>
  );
};
