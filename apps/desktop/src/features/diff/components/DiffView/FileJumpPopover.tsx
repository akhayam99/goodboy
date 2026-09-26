import { useEffect, useRef } from 'react';
import { Check, MessageSquare, Search } from 'lucide-react';
import { KbdPill, cn, tintClasses } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useFileJump } from '../../hooks/useFileJump';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD, splitPath } from '../../lib/fileStatus';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly activePath: string | null;
  readonly commentCountOf: (path: string) => number;
  readonly isViewed: (file: FileDiff) => boolean;
  readonly onPick: (path: string) => void;
};

export const FileJumpPopover = ({ files, activePath, commentCountOf, isViewed, onPick }: Props) => {
  const jump = useFileJump({ files, onPick });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setActiveIndex } = jump;

  useEffect(() => {
    inputRef.current?.focus();
    const index = files.findIndex((file) => file.path === activePath);
    if (index > 0) {
      setActiveIndex(index);
    }
  }, [activePath, files, setActiveIndex]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${jump.activeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [jump.activeIndex]);

  const activeId = `diff-jump-${jump.activeIndex}`;

  return (
    <div className="flex w-full flex-col">
      <label className="flex h-9 items-center gap-2 px-3">
        <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={jump.query}
          onChange={(event) => jump.setQuery(event.target.value)}
          onKeyDown={jump.onKeyDown}
          placeholder="Filter files"
          aria-label="Filter files"
          role="combobox"
          aria-expanded
          aria-controls="diff-jump-list"
          aria-activedescendant={jump.results.length > 0 ? activeId : undefined}
          className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-faint-foreground"
        />
        <span className="shrink-0 text-secondary tabular-nums text-faint-foreground">
          {jump.results.length}
        </span>
      </label>
      <div
        ref={listRef}
        id="diff-jump-list"
        role="listbox"
        aria-label="Changed files"
        className="max-h-80 overflow-y-auto py-1"
      >
        {jump.results.length === 0 ? (
          <p className="px-3 py-2 text-label text-muted-foreground">No file matches</p>
        ) : (
          jump.results.map((file, index) => {
            const { dir, name } = splitPath(file.path);
            const tone = tintClasses(STATUS_TONE[file.status]);
            const count = commentCountOf(file.path);
            return (
              <div
                key={file.path}
                id={`diff-jump-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === jump.activeIndex}
                onPointerEnter={() => jump.setActiveIndex(index)}
                onClick={() => onPick(file.path)}
                className={cn(
                  'grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto_28px_16px] items-center gap-2 px-3 py-1 text-xs',
                  index === jump.activeIndex && 'bg-hover',
                )}
              >
                <span
                  aria-label={STATUS_WORD[file.status]}
                  className={cn(
                    'flex size-4 items-center justify-center rounded-sm font-mono text-meta font-bold',
                    tone.text,
                    tone.bg,
                  )}
                >
                  {STATUS_LETTER[file.status]}
                </span>
                <span className="min-w-0 truncate">
                  <span className="text-foreground">{name}</span>{' '}
                  <span className="text-faint-foreground">{dir.replace(/\/$/, '')}</span>
                </span>
                <span className="text-secondary tabular-nums">
                  {file.additions > 0 ? (
                    <span className="text-success">+{file.additions}</span>
                  ) : null}{' '}
                  {file.deletions > 0 ? (
                    <span className="text-danger">−{file.deletions}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-0.5 text-secondary tabular-nums text-muted-foreground">
                  {count > 0 ? (
                    <>
                      <MessageSquare size={10} aria-hidden />
                      <span aria-label={`${count} comments`}>{count}</span>
                    </>
                  ) : null}
                </span>
                <span className="flex justify-end">
                  {isViewed(file) ? (
                    <Check size={ICON_SIZE.row} aria-label="Viewed" className="text-success" />
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 text-secondary text-faint-foreground">
        <span className="flex items-center gap-1">
          <KbdPill>↑</KbdPill>
          <KbdPill>↓</KbdPill>
          move
        </span>
        <span className="flex items-center gap-1">
          <KbdPill>↵</KbdPill>
          open
        </span>
        <span className="flex items-center gap-1">
          <KbdPill>[</KbdPill>
          <KbdPill>]</KbdPill>
          previous, next file
        </span>
      </div>
    </div>
  );
};
