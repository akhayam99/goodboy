import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  AnchoredPopover,
  EmptyLine,
  PopoverBody,
  ROW_INTERACTIVE,
  Skeleton,
  cn,
  useDropdown,
} from '@goodboy/ui';
import type { GrepMatch } from '../../../worktree/worktree';
import { useIdentifierUses } from '../../hooks/useIdentifierUses';
import type { PeekAnchor } from '../../lib/wordAtEvent';
import { PeekGroup } from './PeekGroup';
import { peekGroups } from './peekGroups';

type Props = {
  readonly anchor: PeekAnchor;
  readonly word: string;
  readonly worktreePath: string;
  readonly changedPaths: ReadonlySet<string>;
  readonly changedLines?: ReadonlyMap<string, ReadonlySet<number>>;
  readonly onPick: (match: GrepMatch) => void;
  readonly onClose: () => void;
};

const MAX_HEIGHT_PX = 360;
const WIDTH_PX = 420;

export const IdentifierPeek = ({
  anchor,
  word,
  worktreePath,
  changedPaths,
  changedLines,
  onPick,
  onClose,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-[420px]',
    expectedHeight: MAX_HEIGHT_PX,
    expectedWidth: WIDTH_PX,
  });
  const [isExpanded, setIsExpanded] = useState(false);
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
  const groups = peekGroups({ matches, word, changedPaths, changedLines, isExpanded });

  const firstRevealed = groups.firstRevealed;
  useEffect(() => {
    if (firstRevealed === undefined) {
      return;
    }
    const rows = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>('[data-peek-row]') ?? [],
    );
    rows
      .find(
        (row) => row.getAttribute('aria-label') === `${firstRevealed.path}:${firstRevealed.line}`,
      )
      ?.focus();
  }, [firstRevealed]);

  type PickParams = { readonly match: GrepMatch };

  const pick = ({ match }: PickParams) => {
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
        <PopoverBody>
          <div
            ref={contentRef}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="flex min-h-0 flex-col gap-3 p-1 outline-none"
          >
            <div className="flex flex-col gap-1 px-2 py-1 text-label text-muted-foreground">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-code text-foreground">{word}</span>
                {groups.kind !== null ? <span className="text-meta">{groups.kind}</span> : null}
              </div>
              {uses.status === 'searching' ? (
                <span role="status" className="flex items-center gap-2">
                  <Skeleton className="h-3 w-8 rounded-sm" />
                  Searching
                </span>
              ) : null}
              {uses.status === 'ready' && groups.kind !== null ? (
                <span className="text-meta">{groups.summary}</span>
              ) : null}
              {uses.status === 'error' ? <span role="alert">Search failed</span> : null}
            </div>
            {uses.status === 'error' ? (
              <p className="px-2 text-meta text-muted-foreground">{uses.message}</p>
            ) : null}
            {uses.status === 'ready' && groups.kind === null ? (
              <EmptyLine>Not defined in this project</EmptyLine>
            ) : null}
            {groups.kind !== null ? (
              <>
                {[
                  { label: 'Defined in', matches: groups.definitions },
                  { label: 'In this change', matches: groups.inChange },
                  { label: 'Elsewhere', matches: groups.elsewhere },
                ].map(({ label, matches: groupMatches }) => (
                  <PeekGroup
                    key={label}
                    label={label}
                    matches={groupMatches}
                    word={word}
                    changedPaths={changedPaths}
                    changedLines={changedLines}
                    onPick={(match) => pick({ match })}
                  />
                ))}
                {groups.hiddenCount > 0 ? (
                  <button
                    type="button"
                    data-peek-row=""
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded(true)}
                    className={cn(
                      ROW_INTERACTIVE,
                      'min-h-8 rounded-sm px-2 text-left text-label text-muted-foreground',
                    )}
                  >
                    Show {groups.hiddenCount} more
                  </button>
                ) : null}
              </>
            ) : null}
            {uses.status === 'ready' && groups.kind !== null && uses.isTruncated ? (
              <p className="px-2 text-meta text-faint-foreground">Showing the first 300.</p>
            ) : null}
          </div>
        </PopoverBody>
      </AnchoredPopover>
    </div>
  );
};
