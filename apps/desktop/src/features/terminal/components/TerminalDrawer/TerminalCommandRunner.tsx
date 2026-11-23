import { useCallback, useMemo, useRef, useState } from 'react';
import type { Agent, MountId, Session } from '@goodboy/types';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { choiceKey } from '../../../suggestions/choiceKey';
import type { NextMove } from '../../../suggestions/types';
import { typedCommandTrackerOf, useSuggestionRunner } from '../../../suggestions';
import { promptTextOf } from '../../promptTextOf';
import { invokeTerminalWrite } from '../../terminal';
import { stringToBase64 } from '../../terminalDriver';
import { terminalCommandMoveOf } from '../../terminalCommandMoveOf';
import { TerminalCommandStrip } from './TerminalCommandStrip';

type Props = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly moves: ReadonlyArray<NextMove>;
  readonly mountId: MountId;
  readonly tab: TerminalTab;
  readonly isTabBusy: boolean;
};

type FailureParams = {
  readonly key: string;
  readonly message: string;
};

type KeyParams = {
  readonly key: string;
};

const TYPE_HERE = 'type-here';

const NO_QUESTIONS = (): void => undefined;

export const TerminalCommandRunner = ({
  session,
  agents,
  moves,
  mountId,
  tab,
  isTabBusy,
}: Props) => {
  const record = useAppStore((state) => state.recordTerminalScriptRun);
  const reportError = useAppStore((state) => state.reportError);
  const [failures, setFailures] = useState<ReadonlyMap<string, string>>(new Map());
  const [typedIds, setTypedIds] = useState<ReadonlySet<string>>(new Set());
  const failed = useRef(new Set<string>());
  const onFailure = useCallback(({ key, message }: FailureParams) => {
    failed.current.add(key);
    setFailures((current) => new Map(current).set(key, message));
  }, []);
  const runner = useSuggestionRunner({
    session,
    agents,
    onSelectQuestions: NO_QUESTIONS,
    onFailure,
  });
  const move = useMemo(
    () => terminalCommandMoveOf({ moves, mountId, hiddenIds: runner.notNowIds }),
    [moves, mountId, runner.notNowIds],
  );
  if (move === null) {
    return null;
  }
  const actions = runner.trackedActions({ suggestion: move });
  const primary = actions.primary;
  if (primary === null) {
    return null;
  }
  const { command } = move.payload;
  const typedKey = choiceKey({ suggestion: move, choiceId: TYPE_HERE });
  const isTyping = command.mode === 'type';
  const canTypeHere = isTyping && tab.status !== 'exited' && !isTabBusy;
  const clear = ({ key }: KeyParams) => {
    failed.current.delete(key);
    setFailures((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };
  const typeHere = async () => {
    await invokeTerminalWrite(
      tab.id,
      stringToBase64({
        value: promptTextOf({ text: command.text, cwd: command.cwd, shellCwd: tab.cwd }),
      }),
    );
    if (move.kind === 'next-script' && command.scriptId !== null) {
      typedCommandTrackerOf({ record, reportError })({
        sessionId: session.id,
        terminalId: tab.id,
        scriptId: command.scriptId,
        name: move.payload.scriptName,
        command: command.text,
        mountId,
      });
    }
  };
  const run = async () => {
    const key = canTypeHere ? typedKey : move.id;
    clear({ key });
    await (canTypeHere
      ? runner.trackChoiceFor({ suggestion: move, actions })({
          actionId: TYPE_HERE,
          task: typeHere,
        })
      : primary.run());
    if (isTyping && !failed.current.has(key)) {
      setTypedIds((current) => new Set(current).add(move.id));
    }
  };
  return (
    <TerminalCommandStrip
      move={move}
      label={primary.label}
      isPending={
        runner.pending.pendingKeys.has(move.id) || runner.pending.pendingKeys.has(typedKey)
      }
      isTyped={typedIds.has(move.id)}
      failure={failures.get(typedKey) ?? failures.get(move.id) ?? null}
      onRun={() => {
        void run();
      }}
      onNotNow={() => runner.onNotNow({ suggestion: move })}
    />
  );
};
