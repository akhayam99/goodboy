import { activateWorkflowAgent } from './activateWorkflowAgent';
import { advanceClusterImplementation } from './clusterImplementation';
import { retryStepSummary } from './retryStepSummary';
import { attachWorkflowToSession } from './attachWorkflowToSession';
import { deleteStepDef } from './deleteStepDef';
import { deleteWorkflow } from './deleteWorkflow';
import { detachWorkflowFromSession } from './detachWorkflowFromSession';
import { discardWorkflow } from './discardWorkflow';
import { finalizeWorkflowStep } from './finalizeWorkflowStep';
import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';
import { loadPhaseTemplates } from './loadPhaseTemplates';
import { loadStepLibrary } from './loadStepLibrary';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { continueWorkflowRun } from './continueWorkflowRun';
import { orchestrateNextStep } from './orchestrateNextStep';
import { setWorkflowOrchestratorHints } from './setWorkflowOrchestratorHints';
import { reorderSessionWorkflows } from './reorderSessionWorkflows';
import { restoreWorkflow } from './restoreWorkflow';
import { retryWorkflowOrchestration } from './retryWorkflowOrchestration';
import { reprocessGoalForWorkflow } from './reprocessGoalForWorkflow';
import { resetWorkflows } from './resetWorkflows';
import { savePhaseTemplate } from './savePhaseTemplate';
import { saveStepDef } from './saveStepDef';
import { advanceScoutTree } from './scoutTree';
import { skipStuckStepAndAdvance } from './skipStuckStepAndAdvance';
import { setWorkflowRunAutoRun } from './setWorkflowRunAutoRun';
import { startWorkflowRun } from './startWorkflowRun';
import type { GetFn, SetFn } from './types';

export const createWorkflowsSlice = (set: SetFn, get: GetFn) => {
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
    restoreWorkflow: restoreWorkflow(set, get),
    reorderSessionWorkflows: reorderSessionWorkflows(set, get),
    setWorkflowRunAutoRun: setWorkflowRunAutoRun(set, get),
    startWorkflowRun: startWorkflowRun(set, get),
    reprocessGoalForWorkflow: reprocessGoalForWorkflow(set, get),
    activateWorkflowAgent: activateWorkflowAgent(set, get),
    advanceClusterImplementation: advanceClusterImplementation(set, get),
    finalizeWorkflowStep: finalizeWorkflowStep(set, get),
    skipStuckStepAndAdvance: skipStuckStepAndAdvance(set, get),
    advanceScoutTree: advanceScoutTree(set, get),
    maybeAutoAdvanceWorkflow: maybeAutoAdvanceWorkflow(set, get),
    orchestrateNextStep: orchestrateNextStep(set, get),
    retryWorkflowOrchestration: retryWorkflowOrchestration(set, get),
    continueWorkflowRun: continueWorkflowRun(set, get),
    setWorkflowOrchestratorHints: setWorkflowOrchestratorHints(set, get),
    retryStepSummary: retryStepSummary(set, get),
  };
};
