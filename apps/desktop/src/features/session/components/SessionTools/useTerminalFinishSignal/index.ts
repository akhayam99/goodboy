import { useEffect, useMemo, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { createLatestOnly } from '../../../../../store/runtime/state-writes/latestOnly';
import {
  sessionTerminalOwner,
  terminalOwnerKey,
} from '../../../../../store/slices/terminal/terminalOwner';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';
import { invokeTerminalListLive } from '../../../../terminal/terminal';
import type { ToolSignal } from '../useToolSignal';
import { terminalFinishApplier } from '../terminalFinishApplier';
import { LONG_COMMAND_MS, type BusySince } from '../terminalFinishesOf';

const POLL_MS = 3000;

type Params = {
  readonly sessionId: SessionId;
  readonly isTerminalOpen: boolean;
};

const NO_BUSY: BusySince = new Map();

export const useTerminalFinishSignal = ({
  sessionId,
  isTerminalOpen,
}: Params): ToolSignal | null => {
  const ownerKey = terminalOwnerKey({ owner: sessionTerminalOwner({ sessionId }) });
  const tabs = useAppStore((state) => state.terminalTabs[ownerKey] ?? EMPTY_ARRAY);
  const finish = useAppStore((state) => state.terminalFinishes[sessionId] ?? null);
  const noteTerminalFinished = useAppStore((state) => state.noteTerminalFinished);
  const clearTerminalFinished = useAppStore((state) => state.clearTerminalFinished);
  const busySince = useRef<BusySince>(NO_BUSY);
  const hasReported = useRef(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const isOpenRef = useRef(isTerminalOpen);
  isOpenRef.current = isTerminalOpen;
  const latest = useMemo(() => createLatestOnly(), []);
  const key = `terminal-finish:${sessionId}`;

  useEffect(() => {
    busySince.current = NO_BUSY;
    return () => latest.cancel({ key });
  }, [key, latest]);

  useEffect(() => {
    if (isTerminalOpen) {
      clearTerminalFinished({ sessionId });
    }
  }, [clearTerminalFinished, isTerminalOpen, sessionId]);

  const poll = (): void => {
    latest
      .run({
        key,
        request: invokeTerminalListLive,
        apply: terminalFinishApplier({
          sessionId,
          busySince,
          tabs: tabsRef,
          isOpen: isOpenRef,
          noteTerminalFinished,
        }),
      })
      .catch((error) => {
        if (hasReported.current) {
          return;
        }
        hasReported.current = true;
        void useAppStore.getState().reportError({
          title: "Couldn't read which terminals finished",
          error,
          severity: 'warning',
        });
      });
  };

  usePoll({ run: poll, everyMs: POLL_MS, isEnabled: tabs.length > 0, restartKey: sessionId });

  if (finish === null) {
    return null;
  }
  const took = formatDuration({ durationMs: finish.durationMs }) ?? `${LONG_COMMAND_MS / 1000}s`;
  return { kind: 'changed', note: `${finish.command ?? finish.title} finished after ${took}` };
};
