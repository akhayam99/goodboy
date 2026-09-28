import { HistorySceneShell } from './HistorySceneShell';
import { LEDGER_HEAD_SHAS, LEDGER_TRYING_RUN, ledgerDraft, ledgerGithub } from './historySceneSeed';

const DRAFT = ledgerDraft({ hasConflict: false });
const GITHUB = ledgerGithub({ headSha: LEDGER_HEAD_SHAS.plan });

export const BrandHistoryTrialScene = () => (
  <HistorySceneShell draft={DRAFT} run={LEDGER_TRYING_RUN} github={GITHUB} isLedger />
);
