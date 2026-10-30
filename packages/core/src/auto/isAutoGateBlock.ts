import { AUTO_BLOCK_TEXT } from './turnGate';

export const AUTO_REFUSED_BLOCK_LEAD = 'Auto kept trying to hand work over';

type RefusedBlockParams = Readonly<{
  reason: string;
}>;

export const autoRefusedBlockText = ({ reason }: RefusedBlockParams): string =>
  `${AUTO_REFUSED_BLOCK_LEAD} and was refused: ${reason}. Retry to let it choose again, or tell it what to change.`;

type Params = {
  readonly reason: string | null;
};

const GATE_TEXTS: ReadonlyArray<string> = Object.values(AUTO_BLOCK_TEXT);

export const isAutoGateBlock = ({ reason }: Params): boolean =>
  reason !== null && (GATE_TEXTS.includes(reason) || reason.startsWith(AUTO_REFUSED_BLOCK_LEAD));
