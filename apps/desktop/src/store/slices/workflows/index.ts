import { activateWorkflowAgent } from './activateWorkflowAgent';
import { attachWorkflowToSession } from './attachWorkflowToSession';
import { deleteWorkflow } from './deleteWorkflow';
import { detachWorkflowFromSession } from './detachWorkflowFromSession';
import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';
import { loadPhaseTemplates } from './loadPhaseTemplates';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { reorderSessionWorkflows } from './reorderSessionWorkflows';
import { savePhaseTemplate } from './savePhaseTemplate';
import type { GetFn, SetFn } from './types';

export function createWorkflowsSlice(set: SetFn, get: GetFn) {
  return {
    loadPhaseTemplates: loadPhaseTemplates(set),
    savePhaseTemplate: savePhaseTemplate(set),
    deleteWorkflow: deleteWorkflow(set),
    loadPhaseRunsForSession: loadPhaseRunsForSession(set),
    attachWorkflowToSession: attachWorkflowToSession(set, get),
    detachWorkflowFromSession: detachWorkflowFromSession(set, get),
    reorderSessionWorkflows: reorderSessionWorkflows(set, get),
    activateWorkflowAgent: activateWorkflowAgent(set, get),
    maybeAutoAdvanceWorkflow: maybeAutoAdvanceWorkflow(set, get),
  };
}
