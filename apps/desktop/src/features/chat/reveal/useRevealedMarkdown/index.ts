import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { FreshTail } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { REVEAL_PACE } from '../revealNumbers';
import { useRevealedText } from '../useRevealedText';

type Params = {
  readonly runId: string;
  readonly itemKey: string;
  readonly text: string;
  readonly isComplete: boolean;
};

type RevealedMarkdown = {
  readonly text: string;
  readonly fresh: FreshTail | undefined;
  readonly isRevealing: boolean;
  readonly revealKey: string;
  readonly rootRef: RefObject<HTMLDivElement | null>;
};

export const useRevealedMarkdown = ({
  runId,
  itemKey,
  text,
  isComplete,
}: Params): RevealedMarkdown => {
  const rootRef = useRef<HTMLDivElement>(null);
  const revealed = useRevealedText({ runId, itemKey, text, isComplete });
  const { finish, isRevealing, pieces, revealKey } = revealed;
  const isFinding = useAppStore((state) => state.viewFind !== null);
  const fresh = useMemo<FreshTail | undefined>(
    () =>
      pieces.length === 0
        ? undefined
        : {
            fadeMs: REVEAL_PACE.fadeMs,
            rowStaggerMs: REVEAL_PACE.rowStaggerMs,
            maxStaggerRows: REVEAL_PACE.maxStaggerRows,
            pieces: pieces.map(({ from, to }) => ({ key: from, length: to - from })),
          },
    [pieces],
  );

  useEffect(() => {
    if (isFinding && isRevealing) {
      finish();
    }
  }, [isFinding, isRevealing, finish]);

  useEffect(() => {
    const root = rootRef.current;
    if (!isRevealing || root === null) {
      return;
    }
    const onSelectionChange = () => {
      const selection = document.getSelection();
      if (
        selection !== null &&
        !selection.isCollapsed &&
        selection.anchorNode !== null &&
        root.contains(selection.anchorNode)
      ) {
        finish();
      }
    };
    root.addEventListener('pointerdown', finish);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      root.removeEventListener('pointerdown', finish);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [isRevealing, finish]);

  return { text: revealed.text, fresh, isRevealing, revealKey, rootRef };
};
