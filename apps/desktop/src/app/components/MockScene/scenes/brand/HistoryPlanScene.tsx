import { HistorySceneShell } from './HistorySceneShell';
import { LEDGER_HEAD_SHAS, ledgerDraft, ledgerGithub } from './historySceneSeed';

const DRAFT = ledgerDraft({});
const GITHUB = ledgerGithub({ headSha: LEDGER_HEAD_SHAS.plan });

export const BrandHistoryPlanScene = () => (
  <HistorySceneShell draft={DRAFT} run={null} github={GITHUB} isLedger />
);
