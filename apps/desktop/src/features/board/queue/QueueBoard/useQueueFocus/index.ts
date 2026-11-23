import { useCallback, useState, type KeyboardEvent } from 'react';
import type { QueueMove } from '../../needsYouOf';
import { queueKeyOf, QUEUE_BANDS, type QueueBand, type QueueCommand } from '../../queueKeyOf';
import type { RunningRow } from '../../runningGroupsOf';
import type { QueueActions } from '../useQueueActions';
import type { QueueNavigation } from '../useQueueNavigation';

type Params = {
  readonly moves: ReadonlyArray<QueueMove>;
  readonly focusedMoveId: string | null;
  readonly runningRows: ReadonlyArray<RunningRow>;
  readonly ready: ReadonlyArray<ReadyFocusRow>;
  readonly onFocusMove: (params: MoveIdParams) => void;
  readonly onMark: (params: ReadyIdParams) => void;
  readonly onMergeTrain: () => void;
  readonly actions: QueueActions;
  readonly nav: QueueNavigation;
};

type ReadyFocusRow = Readonly<{
  sessionId: string;
}>;

type ReadyIdParams = {
  readonly sessionId: string;
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
  focusedReady: ReadyFocusRow | null;
  peekRunId: string | null;
  togglePeek: (params: RowParams) => void;
  closePeek: () => void;
  syncBand: (params: TargetParams) => void;
  handleKey: (params: KeyParams) => void;
}>;

type BandParams = {
  readonly band: QueueBand;
};

type FocusBandParams = BandParams & {
  readonly root: HTMLElement;
};

const bandOf = ({ target }: TargetParams): QueueBand | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const value = target.closest('[data-queue-band]')?.getAttribute('data-queue-band');
  return QUEUE_BANDS.find((candidate) => candidate === value) ?? null;
};

const focusBand = ({ root, band }: FocusBandParams): void => {
  root.querySelector<HTMLElement>(`[data-queue-band="${band}"]`)?.focus();
};

const isTypingTarget = ({ target }: TargetParams): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [data-terminal], .xterm') !== null
  );
};

const isControlTarget = ({ target }: TargetParams): boolean =>
  target instanceof HTMLElement && target.closest('button, a, [role="tab"]') !== null;

const steppedIndexOf = ({ index, delta, length }: StepParams): number =>
  length === 0 ? 0 : Math.min(length - 1, Math.max(0, index + delta));

export const useQueueFocus = ({
  moves,
  focusedMoveId,
  runningRows,
  ready,
  onFocusMove,
  onMark,
  onMergeTrain,
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

  const togglePeek = useCallback(
    ({ row }: RowParams) => {
      setBand('running');
      const index = runningRows.findIndex((candidate) => candidate.runId === row.runId);
      if (index >= 0) {
        setRunningIndex(index);
      }
      setPeekRunId((current) => (current === row.runId ? null : row.runId));
    },
    [runningRows],
  );
  const closePeek = useCallback(() => setPeekRunId(null), []);
  const syncBand = ({ target }: TargetParams): void => {
    const next = bandOf({ target });
    if (next !== null && next !== band) {
      setBand(next);
    }
  };

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
    }
  };

  const handleKey = ({ event }: KeyParams): void => {
    const command = queueKeyOf({
      key: event.key,
      band,
      isTyping: isTypingTarget({ target: event.target }),
      isOnControl: isControlTarget({ target: event.target }),
      hasModifier: event.metaKey || event.ctrlKey || event.altKey,
    });
    if (command === null) {
      return;
    }
    event.preventDefault();
    const root = event.currentTarget;
    if (command.kind === 'next-band') {
      const next = QUEUE_BANDS[(QUEUE_BANDS.indexOf(band) + 1) % QUEUE_BANDS.length] ?? 'needs-you';
      setBand(next);
      focusBand({ root, band: next });
      return;
    }
    if (band === 'needs-you') {
      if (focusedMove !== null) {
        onMoveCommand({ command, move: focusedMove });
      }
      if (command.kind === 'step') {
        focusBand({ root, band });
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
    if (band !== 'ready') {
      return;
    }
    if (command.kind === 'merge-train') {
      onMergeTrain();
      return;
    }
    if (focusedReady === null) {
      return;
    }
    if (command.kind === 'mark') {
      onMark({ sessionId: focusedReady.sessionId });
      return;
    }
    if (command.kind === 'open') {
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
    syncBand,
    handleKey,
  };
};
