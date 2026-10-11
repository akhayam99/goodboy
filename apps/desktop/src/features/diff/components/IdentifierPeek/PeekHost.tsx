import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { FileDiff } from '@goodboy/types';
import type { GrepMatch } from '../../../worktree/worktree';
import { wordAtEvent, type PeekAnchor } from '../../lib/wordAtEvent';
import { IdentifierPeek } from './index';

export type IdentifierPeekConfig = {
  readonly worktreePath: string;
  readonly onOpenElsewhere: (match: GrepMatch) => void;
};

type Props = {
  readonly config: IdentifierPeekConfig;
  readonly files: ReadonlyArray<FileDiff>;
  readonly expandersRef: MutableRefObject<Map<string, () => Promise<void>>>;
  readonly children: ReactNode;
};

type Open = {
  readonly word: string;
  readonly anchor: PeekAnchor;
  readonly id: number;
};

const FLASH_MS = 1000;
const FLASH_ATTRIBUTE = 'data-peek-flash';
const IGNORED_TARGETS = 'button, input, textarea, [data-slot="diff-line-block"]';

type SectionParams = { readonly host: HTMLElement; readonly path: string };

type RowParams = SectionParams & { readonly line: number };

type PeekParams = {
  readonly event: MouseEvent<HTMLElement>;
  readonly isFromSelection: boolean;
};

const sectionOf = ({ host, path }: SectionParams): Element | null =>
  Array.from(host.querySelectorAll('[data-file-path]')).find(
    (section) => section.getAttribute('data-file-path') === path,
  ) ?? null;

const rowOf = ({ host, path, line }: RowParams) =>
  sectionOf({ host, path })?.querySelector(`[data-line="new:${line}"]`)?.closest('[role="row"]') ??
  null;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const PeekHost = ({ config, files, expandersRef, children }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const nextId = useRef(0);
  const isPicked = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashed = useRef<Element | null>(null);
  const changedPaths = useMemo(() => new Set(files.map((file) => file.path)), [files]);

  const clearFlash = useCallback(() => {
    if (flashTimer.current !== null) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    flashed.current?.removeAttribute(FLASH_ATTRIBUTE);
    flashed.current = null;
  }, []);

  useEffect(() => clearFlash, [clearFlash]);

  const show = useCallback(
    (row: Element) => {
      clearFlash();
      row.scrollIntoView?.({ block: 'center' });
      row.setAttribute(FLASH_ATTRIBUTE, '');
      flashed.current = row;
      flashTimer.current = setTimeout(clearFlash, FLASH_MS);
    },
    [clearFlash],
  );

  const jump = useCallback(
    async (match: GrepMatch) => {
      const host = hostRef.current;
      const hasFile = files.some((file) => file.path === match.path);
      if (host === null || !hasFile) {
        config.onOpenElsewhere(match);
        return;
      }
      let row = rowOf({ host, path: match.path, line: match.line });
      const expand = expandersRef.current.get(match.path);
      if (row === null && expand !== undefined) {
        await expand();
        await nextFrame();
        row = rowOf({ host, path: match.path, line: match.line });
      }
      if (row === null) {
        config.onOpenElsewhere(match);
        return;
      }
      show(row);
    },
    [config, expandersRef, files, show],
  );

  const pick = useCallback(
    (match: GrepMatch) => {
      isPicked.current = true;
      void jump(match);
    },
    [jump],
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
      className="outline-none [&_[data-peek-flash]]:bg-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
    >
      {children}
      {open === null ? null : (
        <IdentifierPeek
          key={open.id}
          anchor={open.anchor}
          word={open.word}
          worktreePath={config.worktreePath}
          changedPaths={changedPaths}
          onPick={pick}
          onClose={close}
        />
      )}
    </div>
  );
};
