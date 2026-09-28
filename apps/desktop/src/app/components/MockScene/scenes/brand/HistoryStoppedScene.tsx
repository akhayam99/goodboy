import { HistorySceneShell } from './HistorySceneShell';
import {
  LEDGER_HEAD_SHAS,
  LEDGER_STOPPED_RUN,
  ledgerDraft,
  ledgerGithub,
} from './historySceneSeed';

const DRAFT = ledgerDraft({});
const GITHUB = ledgerGithub({ headSha: LEDGER_HEAD_SHAS.plan });

export const BrandHistoryStoppedScene = () => (
  <HistorySceneShell draft={DRAFT} run={LEDGER_STOPPED_RUN} github={GITHUB} isLedger />
);
