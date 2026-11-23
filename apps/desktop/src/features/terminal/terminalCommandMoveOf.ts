import type { NextMove } from '../suggestions/types';
import { commandRunOf } from './commandRunOf';

export type TerminalCommandMove = Extract<
  NextMove,
  { readonly kind: 'run-failing-test' | 'next-script' }
>;

type Params = {
  readonly moves: ReadonlyArray<NextMove>;
  readonly mountId: string;
  readonly hiddenIds: ReadonlySet<string>;
};

type MoveParams = {
  readonly move: TerminalCommandMove;
};

const guardedOf = ({ move }: MoveParams): TerminalCommandMove => {
  if (move.kind === 'next-script') {
    const mode = commandRunOf({
      source: 'script',
      scriptId: move.payload.command.scriptId,
      scriptName: move.payload.scriptName,
    });
    return mode === move.payload.command.mode
      ? move
      : { ...move, payload: { ...move.payload, command: { ...move.payload.command, mode } } };
  }
  const mode = commandRunOf({ source: 'check-log', scriptId: null, scriptName: null });
  return mode === move.payload.command.mode
    ? move
    : { ...move, payload: { ...move.payload, command: { ...move.payload.command, mode } } };
};

export const terminalCommandMoveOf = ({
  moves,
  mountId,
  hiddenIds,
}: Params): TerminalCommandMove | null => {
  const move = moves
    .flatMap((candidate) =>
      candidate.kind === 'run-failing-test' || candidate.kind === 'next-script' ? [candidate] : [],
    )
    .find((candidate) => candidate.payload.mountId === mountId && !hiddenIds.has(candidate.id));
  return move === undefined ? null : guardedOf({ move });
};
