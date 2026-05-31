import { activateWorkflowAgent } from './activateWorkflowAgent';
import { advanceClusterImplementation } from './clusterImplementation';
import { attachWorkflowToSession } from './attachWorkflowToSession';
import { deleteStepDef } from './deleteStepDef';
import { deleteWorkflow } from './deleteWorkflow';
import { detachWorkflowFromSession } from './detachWorkflowFromSession';
import { discardWorkflow } from './discardWorkflow';
import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';
import { loadPhaseTemplates } from './loadPhaseTemplates';
import { loadStepLibrary } from './loadStepLibrary';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { reorderSessionWorkflows } from './reorderSessionWorkflows';
import { resetWorkflows } from './resetWorkflows';
import { savePhaseTemplate } from './savePhaseTemplate';
import { saveStepDef } from './saveStepDef';
import type { GetFn, SetFn } from './types';

export function createWorkflowsSlice(set: SetFn, get: GetFn) {
  return {
    loadPhaseTemplates: loadPhaseTemplates(set),
    savePhaseTemplate: savePhaseTemplate(set),
    deleteWorkflow: deleteWorkflow(set),
    loadStepLibrary: loadStepLibrary(set),
    saveStepDef: saveStepDef(set),
    deleteStepDef: deleteStepDef(set),
    resetWorkflows: resetWorkflows(set, get),
    loadPhaseRunsForSession: loadPhaseRunsForSession(set),
    attachWorkflowToSession: attachWorkflowToSession(set, get),
    detachWorkflowFromSession: detachWorkflowFromSession(set, get),
    discardWorkflow: discardWorkflow(set, get),
    reorderSessionWorkflows: reorderSessionWorkflows(set, get),
    activateWorkflowAgent: activateWorkflowAgent(set, get),
    advanceClusterImplementation: advanceClusterImplementation(set, get),
    maybeAutoAdvanceWorkflow: maybeAutoAdvanceWorkflow(set, get),
  };
}
