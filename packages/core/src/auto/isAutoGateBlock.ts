import { AUTO_BLOCK_TEXT } from './turnGate';

type Params = {
  readonly reason: string | null;
};

const GATE_TEXTS: ReadonlyArray<string> = Object.values(AUTO_BLOCK_TEXT);

export const isAutoGateBlock = ({ reason }: Params): boolean =>
  reason !== null && GATE_TEXTS.includes(reason);
