import { LEGACY_GATE_TEXTS } from './legacyGateTexts';
import { AUTO_BLOCK_TEXT } from './turnGate';

export const AUTO_REFUSED_BLOCK_LEAD = 'The Lead kept trying to start agents';

type RefusedBlockParams = Readonly<{
  reason: string;
}>;

export const autoRefusedBlockText = ({ reason }: RefusedBlockParams): string =>
  `${AUTO_REFUSED_BLOCK_LEAD} and was refused: ${reason}. Retry to let it choose again, or tell it what to change.`;

type Params = {
  readonly reason: string | null;
};

const GATE_TEXTS: ReadonlyArray<string> = [
  ...Object.values(AUTO_BLOCK_TEXT),
  LEGACY_GATE_TEXTS.noProgress,
  LEGACY_GATE_TEXTS.budget,
  LEGACY_GATE_TEXTS.returns,
  LEGACY_GATE_TEXTS.timeLimit,
];

const REFUSED_PREFIXES: ReadonlyArray<string> = [
  AUTO_REFUSED_BLOCK_LEAD,
  LEGACY_GATE_TEXTS.refusedPrefix,
];

export const isAutoGateBlock = ({ reason }: Params): boolean =>
  reason !== null &&
  (GATE_TEXTS.includes(reason) || REFUSED_PREFIXES.some((prefix) => reason.startsWith(prefix)));
