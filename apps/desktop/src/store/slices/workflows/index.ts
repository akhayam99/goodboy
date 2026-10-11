import { activateWorkflowAgent } from './activateWorkflowAgent';
import { addStepToWorkflowRun } from './addStepToWorkflowRun';
import { advanceClusterImplementation } from './clusterImplementation';
import { retryStepSummary } from './retryStepSummary';
import { recoverStuckStep } from './recoverStuckStep';
import { askAgentToContinue } from './askAgentToContinue';
import { attachWorkflowToSession } from './attachWorkflowToSession';
import { closeWorkflowRun } from './closeWorkflowRun';
import { deleteStepDef } from './deleteStepDef';
import { deleteWorkflow } from './deleteWorkflow';
import { detachWorkflowFromSession } from './detachWorkflowFromSession';
import { discardWorkflow } from './discardWorkflow';
import { finalizeWorkflowStep } from './finalizeWorkflowStep';
import { generateWorkflowTitle } from './generateWorkflowTitle';
import { suggestWorkflowTitle } from './suggestWorkflowTitle';
import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';
import { loadPhaseTemplates } from './loadPhaseTemplates';
import { loadStepLibrary } from './loadStepLibrary';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { continueWorkflowRun } from './continueWorkflowRun';
import { copyWorkflowsFromWorkspaces } from './copyWorkflowsFromWorkspaces';
import { orchestrateNextStep } from './orchestrateNextStep';
import { addWorkflowOrchestratorHint } from './addWorkflowOrchestratorHint';
import { removeWorkflowOrchestratorHint } from './removeWorkflowOrchestratorHint';
import { setWorkflowOrchestratorRouting } from './setWorkflowOrchestratorRouting';
import { renameWorkflowRun } from './renameWorkflowRun';
import { restoreWorkflow } from './restoreWorkflow';
import { retryWorkflowOrchestration } from './retryWorkflowOrchestration';
import { reprocessGoalForWorkflow } from './reprocessGoalForWorkflow';
import { resetWorkflows } from './resetWorkflows';
import { savePhaseTemplate } from './savePhaseTemplate';
import { saveStepDef } from './saveStepDef';
import { advanceScoutTree } from './scoutTree';
import { skipStuckStepAndAdvance } from './skipStuckStepAndAdvance';
import { setWorkflowRunAutoRun } from './setWorkflowRunAutoRun';
import { setWorkflowRunSpendLimit } from './setWorkflowRunSpendLimit';
import { startWorkflowRun } from './startWorkflowRun';
import { sweepIdleRuns } from './sweepIdleRuns';
import { stopWorkflowRunNow } from './stopWorkflowRunNow';
import { pauseWorkflowRun } from './pauseWorkflowRun';
import { resumeWorkflowRun } from './resumeWorkflowRun';
import { approveWorkflowRunPlan } from './approveWorkflowRunPlan';
import { setWorkflowRunAutonomy } from './setWorkflowRunAutonomy';
import type { SliceDeps } from '../../slice-types';

export const createWorkflowsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadPhaseTemplates: loadPhaseTemplates(set),
    copyWorkflowsFromWorkspaces: copyWorkflowsFromWorkspaces({ set }),
    savePhaseTemplate: savePhaseTemplate(set),
    deleteWorkflow: deleteWorkflow(set, get),
    generateWorkflowTitle: generateWorkflowTitle(set, get),
    suggestWorkflowTitle: suggestWorkflowTitle(set, get),
    loadStepLibrary: loadStepLibrary(set),
    saveStepDef: saveStepDef(set),
    deleteStepDef: deleteStepDef(set),
    resetWorkflows: resetWorkflows({ get }),
    loadPhaseRunsForSession: loadPhaseRunsForSession(set),
    attachWorkflowToSession: attachWorkflowToSession(set, get),
    detachWorkflowFromSession: detachWorkflowFromSession(set, get),
    discardWorkflow: discardWorkflow(set, get),
    restoreWorkflow: restoreWorkflow(set, get),
    renameWorkflowRun: renameWorkflowRun(set, get),
    setWorkflowRunAutoRun: setWorkflowRunAutoRun(set, get),
    setWorkflowRunAutonomy: setWorkflowRunAutonomy(set, get),
    setWorkflowRunSpendLimit: setWorkflowRunSpendLimit(set, get),
    startWorkflowRun: startWorkflowRun(set, get),
    stopWorkflowRunNow: stopWorkflowRunNow(set, get),
    pauseWorkflowRun: pauseWorkflowRun(set, get),
    resumeWorkflowRun: resumeWorkflowRun(set, get),
    approveWorkflowRunPlan: approveWorkflowRunPlan(set, get),
    closeWorkflowRun: closeWorkflowRun(set, get),
    reprocessGoalForWorkflow: reprocessGoalForWorkflow(set, get),
    activateWorkflowAgent: activateWorkflowAgent(set, get),
    addStepToWorkflowRun: addStepToWorkflowRun(set, get),
    advanceClusterImplementation: advanceClusterImplementation(set, get),
    finalizeWorkflowStep: finalizeWorkflowStep(set, get),
    skipStuckStepAndAdvance: skipStuckStepAndAdvance(set, get),
    advanceScoutTree: advanceScoutTree(set, get),
    maybeAutoAdvanceWorkflow: maybeAutoAdvanceWorkflow(set, get),
    orchestrateNextStep: orchestrateNextStep(set, get),
    retryWorkflowOrchestration: retryWorkflowOrchestration(set, get),
    continueWorkflowRun: continueWorkflowRun(set, get),
    addWorkflowOrchestratorHint: addWorkflowOrchestratorHint(set, get),
    removeWorkflowOrchestratorHint: removeWorkflowOrchestratorHint(set, get),
    setWorkflowOrchestratorRouting: setWorkflowOrchestratorRouting(set, get),
    retryStepSummary: retryStepSummary(set, get),
    recoverStuckStep: recoverStuckStep(get),
    askAgentToContinue: askAgentToContinue(get),
    sweepIdleRuns: sweepIdleRuns(set, get),
  };
};
