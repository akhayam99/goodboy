import { LEGACY_GATE_TEXTS } from './legacyGateTexts';
import { AUTO_BLOCK_TEXT } from './turnGate';

type Params = {
  readonly reason: string | null;
};

export const isAutoBudgetBlock = ({ reason }: Params): boolean =>
  reason === AUTO_BLOCK_TEXT.budget || reason === LEGACY_GATE_TEXTS.budget;
