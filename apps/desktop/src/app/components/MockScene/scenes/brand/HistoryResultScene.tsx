import { initialPlanItems } from '../../../../../features/history/historyPlan';
import { HistorySceneShell } from './HistorySceneShell';
import {
  LEDGER_HEAD_SHAS,
  LEDGER_RESULT_COMMITS,
  LEDGER_RESULT_GRAPH,
  LEDGER_RESULT_RUN,
  ledgerDraft,
  ledgerGithub,
} from './historySceneSeed';

const DRAFT = ledgerDraft({
  commits: LEDGER_RESULT_COMMITS,
  items: initialPlanItems({ commits: LEDGER_RESULT_COMMITS }),
  graph: LEDGER_RESULT_GRAPH,
  hasConflict: false,
});
const GITHUB = ledgerGithub({ headSha: LEDGER_HEAD_SHAS.result });

export const BrandHistoryResultScene = () => (
  <HistorySceneShell draft={DRAFT} run={LEDGER_RESULT_RUN} github={GITHUB} isLedger />
);
