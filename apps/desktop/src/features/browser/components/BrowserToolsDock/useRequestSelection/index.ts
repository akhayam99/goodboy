import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { BrowserConsoleEntry } from '../../../types';
import { requestKeyOf } from '../requestKeyOf';

type Params = {
  readonly rows: ReadonlyArray<BrowserConsoleEntry>;
  readonly liveId: string | null;
  readonly doc: string | null;
  readonly list: RefObject<HTMLDivElement | null>;
};

type OpenParams = {
  readonly entry: BrowserConsoleEntry;
};

type Selection = {
  readonly liveId: string | null;
  readonly doc: string | null;
  readonly key: string;
};

export const useRequestSelection = ({ rows, liveId, doc, list }: Params) => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const returnKey = useRef<string | null>(null);
  const isSameDocument = selection !== null && selection.liveId === liveId && selection.doc === doc;
  const openedAt = isSameDocument
    ? rows.findIndex((entry) => requestKeyOf({ entry }) === selection.key)
    : -1;

  if (selection !== null && openedAt < 0) {
    setSelection(null);
  }

  useLayoutEffect(() => {
    const key = returnKey.current;
    const node = list.current;
    if (key === null || selection !== null || node === null) {
      return;
    }
    returnKey.current = null;
    const row = Array.from(node.querySelectorAll<HTMLElement>('[data-request-key]')).find(
      (candidate) => candidate.dataset.requestKey === key,
    );
    const target = row?.querySelector('button') ?? node;
    target.focus();
  }, [selection, list]);

  const open = ({ entry }: OpenParams): void =>
    setSelection({ liveId, doc, key: requestKeyOf({ entry }) });

  const back = (): void => {
    returnKey.current = selection?.key ?? null;
    setSelection(null);
  };

  return { openedAt, open, back };
};
