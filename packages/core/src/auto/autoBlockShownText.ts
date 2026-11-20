import { AUTO_REFUSED_BLOCK_LEAD } from './isAutoGateBlock';
import { LEGACY_GATE_TEXTS } from './legacyGateTexts';
import { AUTO_RETURNS_WINDOW_MS, AUTO_TREE_LIMITS } from './limits';
import { AUTO_BLOCK_TEXT, AUTO_STALE_DECIDE_TEXT } from './turnGate';

type Params = {
  readonly reason: string;
};

const SHOWN_OF_LEGACY: Readonly<Record<string, string>> = {
  [LEGACY_GATE_TEXTS.noProgress]: AUTO_BLOCK_TEXT.limit_no_progress,
  [LEGACY_GATE_TEXTS.budget]: AUTO_BLOCK_TEXT.budget,
  [LEGACY_GATE_TEXTS.returns]: `Agents came back to the Lead ${AUTO_TREE_LIMITS.returnsPerTreeWindow} times in ${AUTO_RETURNS_WINDOW_MS / 60_000} minutes.`,
  [LEGACY_GATE_TEXTS.staleDecide]: AUTO_STALE_DECIDE_TEXT,
};

export const autoBlockShownText = ({ reason }: Params): string => {
  const shown = SHOWN_OF_LEGACY[reason];
  if (shown !== undefined) {
    return shown;
  }
  if (reason.startsWith(LEGACY_GATE_TEXTS.refusedPrefix)) {
    return `${AUTO_REFUSED_BLOCK_LEAD}${reason.slice(LEGACY_GATE_TEXTS.refusedPrefix.length)}`;
  }
  return reason;
};
