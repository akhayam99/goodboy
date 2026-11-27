import { useEffect, useRef, useState } from 'react';
import { browserHost } from '../../browserHost';
import type {
  BrowserIsolation,
  BrowserRecordsCleared,
  BrowserSiteRecord,
  BrowserSiteRecords,
} from '../../types';

type ClearedParams = {
  readonly tabId: string;
  readonly cleared: BrowserRecordsCleared;
};

type FailedParams = {
  readonly tabId: string;
  readonly error: unknown;
};

type RequestParams = {
  readonly tabId: string;
};

type Params = {
  readonly tabId: string | undefined;
  readonly isReadable: boolean;
  readonly onClearing: () => void;
  readonly onCleared: (params: ClearedParams) => void;
  readonly onFailed: (params: FailedParams) => void;
};

type RecordsRead = {
  readonly tabId: string | null;
  readonly records: ReadonlyArray<BrowserSiteRecord>;
};

const NO_RECORDS: ReadonlyArray<BrowserSiteRecord> = [];
const NOTHING_READ: RecordsRead = { tabId: null, records: NO_RECORDS };

const keepSharedStore = (): void => undefined;

export const useSiteRecords = ({
  tabId,
  isReadable,
  onClearing,
  onCleared,
  onFailed,
}: Params): BrowserSiteRecords => {
  const [isolation, setIsolation] = useState<BrowserIsolation | null>(null);
  const [read, setRead] = useState<RecordsRead>(NOTHING_READ);
  const latest = useRef(0);
  const pendingTab = useRef<string | null>(null);
  const shownTab = useRef(tabId);
  shownTab.current = tabId;

  useEffect(() => {
    if (!isReadable) {
      return;
    }
    let isCurrent = true;
    void browserHost.profileIsolation().then((answer) => {
      if (isCurrent) {
        setIsolation(answer);
      }
    }, keepSharedStore);
    return () => {
      isCurrent = false;
    };
  }, [isReadable]);

  const canList = isReadable && isolation === 'perWorkspace' && tabId !== undefined;

  const request = ({ tabId: askedTab }: RequestParams) => {
    latest.current += 1;
    const asked = latest.current;
    pendingTab.current = askedTab;
    void browserHost.siteDataList({ tabId: askedTab }).then(
      (records) => {
        if (asked !== latest.current) {
          return;
        }
        pendingTab.current = null;
        if (shownTab.current === askedTab) {
          setRead({ tabId: askedTab, records: records ?? NO_RECORDS });
        }
      },
      (error: unknown) => {
        if (asked !== latest.current) {
          return;
        }
        pendingTab.current = null;
        if (shownTab.current === askedTab) {
          onFailed({ tabId: askedTab, error });
        }
      },
    );
  };

  return {
    canList,
    records: canList && read.tabId === tabId ? read.records : null,
    read: () => {
      if (!canList || tabId === undefined) {
        return;
      }
      request({ tabId });
    },
    clear: async ({ name }) => {
      if (!canList || tabId === undefined) {
        return;
      }
      const askedTab = tabId;
      onClearing();
      try {
        const cleared = await browserHost.clearSiteRecords({ tabId: askedTab, names: [name] });
        setRead((last) =>
          last.tabId === askedTab
            ? { tabId: askedTab, records: last.records.filter((record) => record.name !== name) }
            : last,
        );
        onCleared({ tabId: askedTab, cleared });
        if (pendingTab.current === askedTab) {
          request({ tabId: askedTab });
        }
      } catch (error: unknown) {
        onFailed({ tabId: askedTab, error });
      }
    },
  };
};
