import { useEffect, useRef } from 'react';
import { Check, MessageSquare, Search } from 'lucide-react';
import { KbdPill, ListboxOptionRow, ScrollFade, cn, tintClasses } from '@goodboy/ui';
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
      <ScrollFade
        className="flex min-h-0 flex-col"
        viewportClassName="max-h-80 p-1"
        fadeFrom="floating"
        fadeSize={12}
      >
        <div ref={listRef} id="diff-jump-list" role="listbox" aria-label="Changed files">
          {jump.results.length === 0 ? (
            <p className="px-2 py-2 text-label text-muted-foreground">No file matches</p>
          ) : (
            jump.results.map((file, index) => {
              const { dir, name } = splitPath(file.path);
              const tone = tintClasses(STATUS_TONE[file.status]);
              const count = commentCountOf(file.path);
              const folder = dir.replace(/\/$/, '');
              return (
                <div key={file.path} data-index={index}>
                  <ListboxOptionRow
                    id={`diff-jump-${index}`}
                    value={file.path}
                    label={name}
                    description={folder === '' ? undefined : folder}
                    isActive={index === jump.activeIndex}
                    isSelected={false}
                    hasLeadingSlot
                    onActivate={() => jump.setActiveIndex(index)}
                    onSelect={() => onPick(file.path)}
                    leading={
                      <span
                        aria-label={STATUS_WORD[file.status]}
                        className={cn(
                          'flex size-4 items-center justify-center rounded-sm font-mono text-meta font-semibold',
                          tone.text,
                          tone.bg,
                        )}
                      >
                        {STATUS_LETTER[file.status]}
                      </span>
                    }
                    meta={
                      <span className="flex items-center gap-2">
                        {file.additions > 0 ? (
                          <span className="text-success">+{file.additions}</span>
                        ) : null}
                        {file.deletions > 0 ? (
                          <span className="text-danger">−{file.deletions}</span>
                        ) : null}
                        {count > 0 ? (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <MessageSquare size={10} aria-hidden />
                            <span aria-label={`${count} comments`}>{count}</span>
                          </span>
                        ) : null}
                        {isViewed(file) ? (
                          <Check
                            size={ICON_SIZE.row}
                            aria-label="Viewed"
                            className="text-success"
                          />
                        ) : null}
                      </span>
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </ScrollFade>
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
