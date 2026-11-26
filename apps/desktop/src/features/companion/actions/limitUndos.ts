import type { LimitKind } from './limitTargets';

export type LimitUndo = {
  readonly kind: LimitKind;
  readonly sessionId: string;
  readonly runId: string;
  readonly previousLimit: number;
  readonly raisedLimit: number;
};

const undos = new Map<string, LimitUndo>();

type SaveParams = {
  readonly raisedActionId: string;
  readonly undo: LimitUndo;
};

export const saveLimitUndo = ({ raisedActionId, undo }: SaveParams): void => {
  undos.set(raisedActionId, undo);
};

type KeyParams = {
  readonly raisedActionId: string;
};

export const limitUndoOf = ({ raisedActionId }: KeyParams): LimitUndo | null =>
  undos.get(raisedActionId) ?? null;

export const dropLimitUndo = ({ raisedActionId }: KeyParams): void => {
  undos.delete(raisedActionId);
};

export const clearLimitUndos = (): void => {
  undos.clear();
};
