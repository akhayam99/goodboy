import type { RefObject } from 'react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab } from '../../../../shared/types/terminal';
import type { AppStore } from '../../../../store/store';
import { lastCommandOf } from '../../../terminal/commandTracker';
import type { LiveTerminal } from '../../../terminal/terminal';
import { terminalFinishesOf, type BusySince } from './terminalFinishesOf';

type Params = {
  readonly sessionId: SessionId;
  readonly busySince: RefObject<BusySince>;
  readonly tabs: RefObject<ReadonlyArray<TerminalTab>>;
  readonly isOpen: RefObject<boolean>;
  readonly noteTerminalFinished: AppStore['noteTerminalFinished'];
};

export const terminalFinishApplier =
  ({ sessionId, busySince, tabs, isOpen, noteTerminalFinished }: Params) =>
  (live: ReadonlyArray<LiveTerminal>): void => {
    const result = terminalFinishesOf({
      live,
      busySince: busySince.current,
      now: Date.now(),
      ownedIds: new Set(tabs.current.map((tab) => tab.id)),
    });
    busySince.current = result.busySince;
    const last = result.finished.at(-1);
    const tab = tabs.current.find((candidate) => candidate.id === last?.terminalId);
    if (last === undefined || tab === undefined || isOpen.current) {
      return;
    }
    noteTerminalFinished({
      sessionId,
      finish: {
        terminalId: tab.id,
        title: tab.title,
        command: lastCommandOf({ terminalId: tab.id }),
        durationMs: last.durationMs,
      },
    });
  };
