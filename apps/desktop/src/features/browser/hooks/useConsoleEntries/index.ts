import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { toCommandError } from '../../../../shared/lib/invokeCommand';
import { usePoll } from '../../../../shared/lib/usePoll';
import {
  EMPTY_TAB_CONSOLE,
  applyConsoleRead,
  type ConsoleFailure,
  type TabConsole,
} from '../../applyConsoleRead';
import { browserHost } from '../../browserHost';
import { listenTabLoad } from '../../listenTabLoad';
import type { BrowserConsoleEntry, BrowserConsoleKind } from '../../types';

const CONSOLE_PULL_MS = 1_000;

const GONE_CODES: ReadonlySet<string> = new Set(['tab-gone', 'tab-closed', 'other-window']);

type Params = {
  readonly sessionId: SessionId;
  readonly liveId: string | null;
  readonly isOpen: boolean;
};

type TabParams = {
  readonly tabId: string;
};

type ClearParams = {
  readonly kind: BrowserConsoleKind;
};

export type ConsoleEntries = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly failure: ConsoleFailure | null;
  readonly clear: (params: ClearParams) => void;
};

type TabMap = Readonly<Record<string, TabConsole>>;

export const useConsoleEntries = ({ sessionId, liveId, isOpen }: Params): ConsoleEntries => {
  const [byTab, setByTab] = useState<TabMap>({});
  const byTabRef = useRef<TabMap>(byTab);
  byTabRef.current = byTab;
  const reading = useRef(new Set<string>());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isOwnLive = useCallback(
    ({ tabId }: TabParams): boolean =>
      Object.values(useAppStore.getState().browserLiveTabs[sessionId] ?? {}).includes(tabId),
    [sessionId],
  );

  const read = useCallback(
    ({ tabId }: TabParams): void => {
      const current = byTabRef.current[tabId] ?? EMPTY_TAB_CONSOLE;
      const sent = { doc: current.doc, after: current.after };
      reading.current.add(tabId);
      void browserHost
        .consoleRead({ tabId, sessionId, doc: sent.doc, after: sent.after })
        .then((answer) => {
          if (!isMounted.current || !isOwnLive({ tabId }) || !Array.isArray(answer?.entries)) {
            return;
          }
          setByTab((previous) => {
            const next = applyConsoleRead({
              current: previous[tabId] ?? EMPTY_TAB_CONSOLE,
              sent,
              answer,
            });
            return next === null ? previous : { ...previous, [tabId]: next };
          });
        })
        .catch((error: unknown) => {
          if (!isMounted.current || GONE_CODES.has(toCommandError(error).message)) {
            return;
          }
          setByTab((previous) => {
            const tab = previous[tabId] ?? EMPTY_TAB_CONSOLE;
            return { ...previous, [tabId]: { ...tab, failure: 'read' } };
          });
        })
        .finally(() => {
          reading.current.delete(tabId);
        });
    },
    [isOwnLive, sessionId],
  );

  usePoll({
    run: () => {
      if (liveId !== null && !reading.current.has(liveId)) {
        read({ tabId: liveId });
      }
    },
    everyMs: CONSOLE_PULL_MS,
    isEnabled: isOpen && liveId !== null,
    gate: 'visible',
    restartKey: liveId ?? '',
  });

  useEffect(() => {
    if (!isOpen || liveId === null) {
      return;
    }
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenTabLoad({
      onLoad: ({ load }) => {
        if (load.tabId === liveId && load.phase === 'finished') {
          read({ tabId: liveId });
        }
      },
    }).then((stop) => {
      if (!isLive) {
        stop();
        return;
      }
      unlisten = stop;
    });
    return () => {
      isLive = false;
      unlisten?.();
    };
  }, [isOpen, liveId, read]);

  const clear = useCallback(
    ({ kind }: ClearParams): void => {
      if (liveId === null) {
        return;
      }
      setByTab((previous) => {
        const tab = previous[liveId];
        if (tab === undefined) {
          return previous;
        }
        return {
          ...previous,
          [liveId]: { ...tab, entries: tab.entries.filter((entry) => entry.kind !== kind) },
        };
      });
    },
    [liveId],
  );

  const shown = liveId === null ? EMPTY_TAB_CONSOLE : (byTab[liveId] ?? EMPTY_TAB_CONSOLE);
  return { entries: shown.entries, failure: shown.failure, clear };
};
