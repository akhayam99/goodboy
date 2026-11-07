import { useLayoutEffect, useRef, useState } from 'react';
import type { ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import { readingOrderOf } from '../readingOrderOf';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly activeRunId: ProviderRunId | null;
};

type RegisterParams = {
  readonly key: string;
  readonly element: HTMLLIElement | null;
};

export const useReadingOrder = ({ rows, activeRunId }: Params) => {
  const elements = useRef(new Map<string, HTMLLIElement>());
  const [unfoldedKeys, setUnfoldedKeys] = useState<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => {
    const liveKeys = rows.flatMap((row) =>
      row.kind === 'item' &&
      row.item.kind === 'assistant_text' &&
      activeRunId !== null &&
      row.item.runId === activeRunId
        ? [row.key]
        : [],
    );
    const next = new Set(unfoldedKeys);
    for (const key of liveKeys) {
      next.add(key);
    }
    if (next.size !== unfoldedKeys.size) {
      setUnfoldedKeys(next);
    }
  }, [rows, activeRunId, unfoldedKeys]);

  useLayoutEffect(() => {
    const first = elements.current.values().next().value;
    const viewport = first?.closest<HTMLElement>('[data-chat-scroll]');
    if (viewport == null || activeRunId !== null || unfoldedKeys.size === 0) {
      return;
    }
    const foldOffscreen = () => {
      const top = viewport.getBoundingClientRect().top;
      const held = [...unfoldedKeys].flatMap((key) => {
        const element = elements.current.get(key);
        return element === undefined ? [] : [element.getBoundingClientRect()];
      });
      if (held.length === 0 || held.some((box) => box.height === 0 || box.bottom > top)) {
        return;
      }
      setUnfoldedKeys(new Set());
    };
    foldOffscreen();
    viewport.addEventListener('scroll', foldOffscreen, { passive: true });
    return () => viewport.removeEventListener('scroll', foldOffscreen);
  }, [activeRunId, unfoldedKeys, rows]);

  const register = ({ key, element }: RegisterParams) => {
    if (element === null) {
      elements.current.delete(key);
      return;
    }
    elements.current.set(key, element);
  };
  return { roles: readingOrderOf({ rows, activeRunId, unfoldedKeys }), register };
};
