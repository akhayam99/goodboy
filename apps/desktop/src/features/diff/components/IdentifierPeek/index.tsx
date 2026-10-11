import { useEffect, useRef, type KeyboardEvent } from 'react';
import { AnchoredPopover, EmptyLine, Skeleton, useDropdown } from '@goodboy/ui';
import type { GrepMatch } from '../../../worktree/worktree';
import { useIdentifierUses } from '../../hooks/useIdentifierUses';
import { isDefinition } from '../../lib/definitionOf';
import type { PeekAnchor } from '../../lib/wordAtEvent';
import { PeekRow } from './PeekRow';

type Props = {
  readonly anchor: PeekAnchor;
  readonly word: string;
  readonly worktreePath: string;
  readonly changedPaths: ReadonlySet<string>;
  readonly onPick: (match: GrepMatch) => void;
  readonly onClose: () => void;
};

type PlacesParams = { readonly count: number };

const MAX_HEIGHT_PX = 360;
const WIDTH_PX = 420;

const places = ({ count }: PlacesParams): string => `${count} ${count === 1 ? 'place' : 'places'}`;

export const IdentifierPeek = ({
  anchor,
  word,
  worktreePath,
  changedPaths,
  onPick,
  onClose,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-[420px]',
    expectedHeight: MAX_HEIGHT_PX,
    expectedWidth: WIDTH_PX,
  });
  const uses = useIdentifierUses({ worktreePath, word });
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);
  const hasRequestedOpen = useRef(false);
  const { open: isOpen, toggle } = dropdown;

  useEffect(() => {
    if (hasRequestedOpen.current) {
      return;
    }
    hasRequestedOpen.current = true;
    toggle();
  }, [toggle]);

  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      contentRef.current?.focus({ preventScroll: true });
      return;
    }
    if (wasOpen.current) {
      onClose();
    }
  }, [isOpen, onClose]);

  const matches = uses.status === 'ready' ? uses.matches : [];
  const definitions = matches.filter((match) =>
    isDefinition({ path: match.path, word, text: match.text }),
  );
  const references = matches.filter((match) => !definitions.includes(match));

  const pick = (match: GrepMatch) => {
    onPick(match);
    dropdown.close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const rows = Array.from(
      dropdown.popupRef.current?.querySelectorAll<HTMLElement>('[data-peek-row]') ?? [],
    );
    if (rows.length === 0) {
      return;
    }
    event.preventDefault();
    const current = rows.findIndex((row) => row === document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = current < 0 ? (step === 1 ? 0 : rows.length - 1) : current + step;
    rows[Math.min(rows.length - 1, Math.max(0, next))]?.focus();
  };

  const group = (label: string, list: ReadonlyArray<GrepMatch>) =>
    list.length === 0 ? null : (
      <div role="group" aria-label={label} className="flex flex-col">
        <h3 className="px-3 pb-1 pt-2 text-eyebrow text-faint-foreground">{label}</h3>
        {list.map((match) => (
          <PeekRow
            key={`${match.path}:${match.line}:${match.column}`}
            match={match}
            word={word}
            isInChange={changedPaths.has(match.path)}
            onPick={pick}
          />
        ))}
      </div>
    );

  return (
    <div
      className="fixed"
      style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
    >
      <AnchoredPopover
        dropdown={dropdown}
        trigger={<span className="block size-full" />}
        anchorClassName="size-full"
        role="dialog"
        ariaLabel={`Uses of ${word}`}
        tabIndex={-1}
        className="max-h-[360px] outline-none"
      >
        <div
          ref={contentRef}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="flex min-h-0 flex-col pb-1 outline-none"
        >
          <div className="flex items-center gap-2 px-3 py-2 text-label text-muted-foreground">
            <span className="text-code text-foreground">{word}</span>
            <span aria-hidden>·</span>
            {uses.status === 'searching' ? (
              <span role="status" className="flex items-center gap-2">
                <Skeleton className="h-3 w-8 rounded-sm" />
                Searching
              </span>
            ) : null}
            {uses.status === 'ready' ? (
              <span>
                Defined in {places({ count: definitions.length })} · Used in{' '}
                {places({ count: references.length })}
              </span>
            ) : null}
            {uses.status === 'error' ? <span role="alert">Search failed</span> : null}
          </div>
          {uses.status === 'error' ? (
            <p className="px-3 pb-2 text-meta text-muted-foreground">{uses.message}</p>
          ) : null}
          {uses.status === 'ready' && matches.length === 0 ? (
            <EmptyLine>Nothing found in this worktree.</EmptyLine>
          ) : null}
          {group('Defined in', definitions)}
          {group('Used in', references)}
          {uses.status === 'ready' && uses.isTruncated ? (
            <p className="px-3 pt-1 text-meta text-faint-foreground">Showing the first 300.</p>
          ) : null}
        </div>
      </AnchoredPopover>
    </div>
  );
};
