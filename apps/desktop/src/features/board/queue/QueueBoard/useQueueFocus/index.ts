import { useCallback, useState, type KeyboardEvent } from 'react';
import type { QueueMove } from '../../needsYouOf';
import { queueKeyOf, QUEUE_BANDS, type QueueBand, type QueueCommand } from '../../queueKeyOf';
import type { ReadyRow } from '../../readyToMergeOf';
import type { RunningRow } from '../../runningGroupsOf';
import type { QueueActions } from '../useQueueActions';
import type { QueueNavigation } from '../useQueueNavigation';

type Params = {
  readonly moves: ReadonlyArray<QueueMove>;
  readonly focusedMoveId: string | null;
  readonly runningRows: ReadonlyArray<RunningRow>;
  readonly ready: ReadonlyArray<ReadyRow>;
  readonly onFocusMove: (params: MoveIdParams) => void;
  readonly actions: QueueActions;
  readonly nav: QueueNavigation;
};

type MoveIdParams = {
  readonly moveId: string;
};

type TargetParams = {
  readonly target: EventTarget | null;
};

type StepParams = {
  readonly index: number;
  readonly delta: 1 | -1;
  readonly length: number;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

type RowParams = {
  readonly row: RunningRow;
};

type MoveCommandParams = {
  readonly command: QueueCommand;
  readonly move: QueueMove;
};

export type QueueFocus = Readonly<{
  band: QueueBand;
  focusedMove: QueueMove | null;
  focusedRow: RunningRow | null;
  focusedReady: ReadyRow | null;
  peekRunId: string | null;
  togglePeek: (params: RowParams) => void;
  closePeek: () => void;
  handleKey: (params: KeyParams) => void;
}>;

const isTypingTarget = ({ target }: TargetParams): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [data-terminal], .xterm') !== null
  );
};

const steppedIndexOf = ({ index, delta, length }: StepParams): number =>
  length === 0 ? 0 : Math.min(length - 1, Math.max(0, index + delta));

export const useQueueFocus = ({
  moves,
  focusedMoveId,
  runningRows,
  ready,
  onFocusMove,
  actions,
  nav,
}: Params): QueueFocus => {
  const [band, setBand] = useState<QueueBand>('needs-you');
  const [runningIndex, setRunningIndex] = useState(0);
  const [readyIndex, setReadyIndex] = useState(0);
  const [peekRunId, setPeekRunId] = useState<string | null>(null);
  const focusedMove = moves.find((move) => move.id === focusedMoveId) ?? moves[0] ?? null;
  const focusedRow = runningRows[Math.min(runningIndex, runningRows.length - 1)] ?? null;
  const focusedReady = ready[Math.min(readyIndex, ready.length - 1)] ?? null;

  const togglePeek = useCallback(({ row }: RowParams) => {
    setBand('running');
    setPeekRunId((current) => (current === row.runId ? null : row.runId));
  }, []);
  const closePeek = useCallback(() => setPeekRunId(null), []);

  const onMoveCommand = ({ command, move }: MoveCommandParams): void => {
    if (command.kind === 'step') {
      const next =
        moves[
          steppedIndexOf({ index: moves.indexOf(move), delta: command.delta, length: moves.length })
        ];
      if (next !== undefined) {
        onFocusMove({ moveId: next.id });
      }
      return;
    }
    if (command.kind === 'open') {
      nav.openLanding({ move });
      return;
    }
    if (command.kind === 'not-now') {
      actions.notNow({ move });
      return;
    }
    const question = move.kind === 'answer' ? move.question : null;
    if (command.kind === 'choice') {
      const choice = question?.suggestedAnswers[command.index];
      if (choice !== undefined) {
        actions.answer({ move, text: choice });
      }
      return;
    }
    if (command.kind !== 'primary') {
      return;
    }
    if (question === null) {
      nav.openPage({ move });
      return;
    }
    const preferred = question.recommendedAnswer ?? question.suggestedAnswers[0];
    if (preferred !== undefined) {
      actions.answer({ move, text: preferred });
    }
  };

  const handleKey = ({ event }: KeyParams): void => {
    const command = queueKeyOf({
      key: event.key,
      band,
      isTyping: isTypingTarget({ target: event.target }),
      hasModifier: event.metaKey || event.ctrlKey || event.altKey,
    });
    if (command === null) {
      return;
    }
    event.preventDefault();
    if (command.kind === 'next-band') {
      setBand(QUEUE_BANDS[(QUEUE_BANDS.indexOf(band) + 1) % QUEUE_BANDS.length] ?? 'needs-you');
      return;
    }
    if (band === 'needs-you') {
      if (focusedMove !== null) {
        onMoveCommand({ command, move: focusedMove });
      }
      return;
    }
    if (command.kind === 'step') {
      const length = band === 'running' ? runningRows.length : ready.length;
      const setIndex = band === 'running' ? setRunningIndex : setReadyIndex;
      setIndex((index) => steppedIndexOf({ index, delta: command.delta, length }));
      return;
    }
    if (band === 'running' && focusedRow !== null) {
      if (command.kind === 'peek') {
        togglePeek({ row: focusedRow });
        return;
      }
      if (command.kind === 'open') {
        nav.openAgent({ row: focusedRow });
      }
      return;
    }
    if (band === 'ready' && command.kind === 'open' && focusedReady !== null) {
      nav.openReady({ sessionId: focusedReady.sessionId });
    }
  };

  return {
    band,
    focusedMove,
    focusedRow,
    focusedReady,
    peekRunId,
    togglePeek,
    closePeek,
    handleKey,
  };
};
