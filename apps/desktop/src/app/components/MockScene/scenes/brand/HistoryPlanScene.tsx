import { HistorySceneShell } from './HistorySceneShell';
import {
  LEDGER_HEAD_SHAS,
  LEDGER_SCENE_GROUP_PLAN,
  ledgerDraft,
  ledgerGithub,
} from './historySceneSeed';

const DRAFT = ledgerDraft({ items: LEDGER_SCENE_GROUP_PLAN });
const GITHUB = ledgerGithub({ headSha: LEDGER_HEAD_SHAS.plan });

export const BrandHistoryPlanScene = () => (
  <HistorySceneShell draft={DRAFT} run={null} github={GITHUB} isLedger />
);
