import { useCallback, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { FileDiff } from '@goodboy/types';
import type { GrepMatch } from '../../../worktree/worktree';
import { wordAtEvent, type PeekAnchor } from '../../lib/wordAtEvent';
import { IdentifierPeek } from './index';

export type PeekOpenParams = {
  readonly word: string;
  readonly match: GrepMatch;
};

export type IdentifierPeekConfig = {
  readonly worktreePath: string;
  readonly onOpen: (params: PeekOpenParams) => void;
};

type Props = {
  readonly config: IdentifierPeekConfig;
  readonly files: ReadonlyArray<FileDiff>;
  readonly children: ReactNode;
};

type Open = {
  readonly word: string;
  readonly anchor: PeekAnchor;
  readonly id: number;
};

const IGNORED_TARGETS = 'button, input, textarea, [data-slot="diff-line-block"]';

type PeekParams = {
  readonly event: MouseEvent<HTMLElement>;
  readonly isFromSelection: boolean;
};

export const PeekHost = ({ config, files, children }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const nextId = useRef(0);
  const isPicked = useRef(false);
  const changedPaths = useMemo(() => new Set(files.map((file) => file.path)), [files]);

  const changedLines = useMemo(
    () =>
      new Map(
        files.map((file) => [
          file.path,
          new Set(
            file.hunks.flatMap((hunk) =>
              hunk.lines.flatMap((line) =>
                line.kind === 'add' && line.newLine !== null ? [line.newLine] : [],
              ),
            ),
          ),
        ]),
      ),
    [files],
  );

  const openWord = open?.word ?? null;
  const pick = useCallback(
    (match: GrepMatch) => {
      if (openWord === null) {
        return;
      }
      isPicked.current = true;
      config.onOpen({ word: openWord, match });
    },
    [config, openWord],
  );

  const close = useCallback(() => {
    setOpen(null);
    if (isPicked.current) {
      isPicked.current = false;
      return;
    }
    hostRef.current?.focus({ preventScroll: true });
  }, []);

  const peek = ({ event, isFromSelection }: PeekParams) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === null || target.closest('[role="grid"]') === null) {
      return;
    }
    if (target.closest(IGNORED_TARGETS) !== null) {
      return;
    }
    const hit = wordAtEvent({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.currentTarget,
      isFromSelection,
    });
    if (hit === null) {
      return;
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(hit.range);
    nextId.current += 1;
    setOpen({ word: hit.word, anchor: hit.anchor, id: nextId.current });
  };

  return (
    <div
      ref={hostRef}
      tabIndex={-1}
      onDoubleClick={(event) => peek({ event, isFromSelection: true })}
      onClick={(event) => {
        if (event.altKey) {
          peek({ event, isFromSelection: false });
        }
      }}
      className="outline-none"
    >
      {children}
      {open === null ? null : (
        <IdentifierPeek
          key={open.id}
          anchor={open.anchor}
          word={open.word}
          worktreePath={config.worktreePath}
          changedPaths={changedPaths}
          changedLines={changedLines}
          onPick={pick}
          onClose={close}
        />
      )}
    </div>
  );
};
