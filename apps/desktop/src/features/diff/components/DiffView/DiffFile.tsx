import { useEffect, useMemo, useRef, useState, type ReactNode, type RefCallback } from 'react';
import { Button, EmptyState, cn, type DiffLayoutMode } from '@goodboy/ui';
import type { DiffCommentAnchor, DiffCommentSide, FileDiff } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useDiffTokens } from '../../hooks/useDiffTokens';
import { isGeneratedPath } from '../../lib/fileStatus';
import { CommentComposer } from './CommentComposer';
import { CommentThread } from './CommentThread';
import { DiffRows, type LineSelection, type LineSpot } from './DiffRows';
import { FileHeader } from './FileHeader';
import type { DiffComments, DiffFileActions, DiffThread, DiffViewed } from './types';

export const INITIAL_VISIBLE_LINES = 1000;
const VISIBLE_LINES_STEP = 2000;

type Props = {
  readonly file: FileDiff;
  readonly layout: DiffLayoutMode;
  readonly wrap: boolean;
  readonly threads: ReadonlyArray<DiffThread>;
  readonly comments: DiffComments | null;
  readonly viewed: DiffViewed | null;
  readonly fileActions: DiffFileActions | null;
  readonly registerRef: RefCallback<HTMLElement>;
  readonly isVisible: boolean;
};

type Drag = {
  readonly side: DiffCommentSide;
  readonly start: number;
  readonly end: number;
};

type Composer =
  { readonly kind: 'line'; readonly anchor: DiffCommentAnchor } | { readonly kind: 'file' };

const anchorEnd = (anchor: DiffCommentAnchor): number => anchor.endLineNumber ?? anchor.lineNumber;

const spotKey = (side: DiffCommentSide, line: number): string => `${side}:${line}`;

const rangeLabel = (anchor: DiffCommentAnchor): string =>
  anchor.endLineNumber && anchor.endLineNumber !== anchor.lineNumber
    ? `lines ${anchor.lineNumber} to ${anchor.endLineNumber}`
    : `line ${anchor.lineNumber}`;

const lineText = (file: FileDiff, anchor: DiffCommentAnchor): string => {
  const out: string[] = [];
  const hi = anchorEnd(anchor);
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const number = anchor.side === 'old' ? line.oldLine : line.newLine;
      const onSide = anchor.side === 'old' ? line.kind !== 'add' : line.kind !== 'del';
      if (onSide && number !== null && number >= anchor.lineNumber && number <= hi) {
        out.push(line.text);
      }
    }
  }
  return out.join('\n');
};

export const DiffFile = ({
  file,
  layout,
  wrap,
  threads,
  comments,
  viewed,
  fileActions,
  registerRef,
  isVisible,
}: Props) => {
  const viewedState = viewed?.stateOf(file) ?? null;
  const isHeavy = file.binary || isGeneratedPath(file.path);
  const [collapsed, setCollapsed] = useState(viewedState === 'viewed' || isHeavy);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [visibleLines, setVisibleLines] = useState(INITIAL_VISIBLE_LINES);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const tokens = useDiffTokens({
    path: file.path,
    hunks: file.hunks,
    enabled: isVisible && !collapsed && !file.binary,
  });

  const canComment = comments !== null;
  const lineThreads = useMemo(() => {
    const map = new Map<string, DiffThread[]>();
    for (const thread of threads) {
      if (thread.anchor === null) {
        continue;
      }
      const key = spotKey(thread.anchor.side, anchorEnd(thread.anchor));
      const list = map.get(key) ?? [];
      list.push(thread);
      map.set(key, list);
    }
    return map;
  }, [threads]);
  const fileThreads = useMemo(() => threads.filter((thread) => thread.anchor === null), [threads]);
  const commentedSpots = useMemo(() => {
    const set = new Set<string>();
    for (const thread of threads) {
      if (thread.anchor === null || thread.isResolved) {
        continue;
      }
      for (let line = thread.anchor.lineNumber; line <= anchorEnd(thread.anchor); line += 1) {
        set.add(spotKey(thread.anchor.side, line));
      }
    }
    return set;
  }, [threads]);
  const openCount = threads.filter((thread) => !thread.isResolved).length;

  useEffect(() => {
    if (drag === null) {
      return;
    }
    const onUp = () => {
      const current = dragRef.current;
      if (current === null) {
        return;
      }
      const lo = Math.min(current.start, current.end);
      const hi = Math.max(current.start, current.end);
      setComposer({
        kind: 'line',
        anchor: { side: current.side, lineNumber: lo, ...(hi > lo ? { endLineNumber: hi } : {}) },
      });
      setDrag(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [drag]);

  const selection: LineSelection | null = drag
    ? { side: drag.side, lo: Math.min(drag.start, drag.end), hi: Math.max(drag.start, drag.end) }
    : composer?.kind === 'line'
      ? {
          side: composer.anchor.side,
          lo: composer.anchor.lineNumber,
          hi: anchorEnd(composer.anchor),
        }
      : null;

  const onPress = (side: DiffCommentSide, line: number, extend: boolean) => {
    if (extend && composer?.kind === 'line' && composer.anchor.side === side) {
      const lo = Math.min(composer.anchor.lineNumber, line);
      const hi = Math.max(anchorEnd(composer.anchor), line);
      setComposer({
        kind: 'line',
        anchor: { side, lineNumber: lo, ...(hi > lo ? { endLineNumber: hi } : {}) },
      });
      return;
    }
    setDrag({ side, start: line, end: line });
  };

  const onHover = (side: DiffCommentSide, line: number) => {
    setDrag((current) =>
      current === null || current.side !== side ? current : { ...current, end: line },
    );
  };

  const onActivate = (side: DiffCommentSide, line: number) => {
    setComposer({ kind: 'line', anchor: { side, lineNumber: line } });
  };

  const renderThreads = (list: ReadonlyArray<DiffThread>) =>
    comments === null
      ? null
      : list.map((thread) => <CommentThread key={thread.id} thread={thread} comments={comments} />);

  const blocksAfter = (spot: LineSpot): ReactNode => {
    const list = lineThreads.get(spotKey(spot.side, spot.line)) ?? [];
    const isComposerHere =
      composer?.kind === 'line' &&
      composer.anchor.side === spot.side &&
      anchorEnd(composer.anchor) === spot.line;
    if (list.length === 0 && !isComposerHere) {
      return null;
    }
    return (
      <div className="flex flex-col gap-1.5">
        {renderThreads(list)}
        {isComposerHere && comments !== null && composer?.kind === 'line' ? (
          <CommentComposer
            label={`${comments.composerLabel} on ${rangeLabel(composer.anchor)}`}
            submitLabel={comments.submitLabel}
            onSubmit={(body) => {
              comments.onSubmit(file.path, composer.anchor, body);
              setComposer(null);
            }}
            onCancel={() => setComposer(null)}
            onAskAgent={
              comments.onAskAgent
                ? () => {
                    comments.onAskAgent?.({
                      filePath: file.path,
                      anchor: composer.anchor,
                      text: lineText(file, composer.anchor),
                    });
                    setComposer(null);
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    );
  };

  const totalLines = file.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
  const remaining = Math.max(0, totalLines - visibleLines);

  const toggleViewed =
    viewed === null
      ? null
      : () => {
          const next = viewedState !== 'viewed';
          viewed.onToggle(file, next);
          setCollapsed(next);
        };

  return (
    <section
      ref={registerRef}
      data-file-path={file.path}
      aria-label={file.path}
      className="flex min-w-0 flex-col"
    >
      <FileHeader
        file={file}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        commentCount={openCount}
        viewed={viewedState}
        onToggleViewed={toggleViewed}
        onOpenInEditor={
          fileActions?.onOpenInEditor ? () => fileActions.onOpenInEditor?.(file.path) : null
        }
        onCommentOnFile={
          comments?.allowFileLevel
            ? () => {
                setCollapsed(false);
                setComposer({ kind: 'file' });
              }
            : null
        }
      />
      {collapsed ? (
        isHeavy && viewedState !== 'viewed' ? (
          <div className="flex items-center gap-2 px-3 py-2 text-2xs text-muted-foreground">
            <span>{file.binary ? 'Binary file' : 'Generated file, hidden by default'}</span>
            {file.binary ? null : (
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(false)}>
                Show file
              </Button>
            )}
          </div>
        ) : null
      ) : (
        <div
          data-slot="diff-file-body"
          className="flex min-w-0 flex-col gap-1.5 pb-4 pt-1 [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
        >
          {fileThreads.length > 0 || composer?.kind === 'file' ? (
            <div className="flex flex-col gap-1.5 py-1">
              {renderThreads(fileThreads)}
              {composer?.kind === 'file' && comments !== null ? (
                <CommentComposer
                  label={`${comments.composerLabel} on this file`}
                  submitLabel={comments.submitLabel}
                  onSubmit={(body) => {
                    comments.onSubmit(file.path, null, body);
                    setComposer(null);
                  }}
                  onCancel={() => setComposer(null)}
                />
              ) : null}
            </div>
          ) : null}
          {file.binary || file.hunks.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.diff}
              tone={CONCEPT_TONE.diff}
              title={file.binary ? 'Binary file, no diff' : 'No changes'}
              size="inline"
              className="justify-center py-4"
            />
          ) : (
            <div
              className={cn(
                'min-w-0 rounded-md',
                !wrap && layout === 'unified' ? 'overflow-x-auto' : 'overflow-hidden',
                drag !== null && 'select-none',
              )}
            >
              <DiffRows
                file={file}
                layout={layout}
                wrap={wrap}
                tokens={tokens}
                visibleLines={visibleLines}
                canComment={canComment}
                selection={selection}
                isRangeCommented={(side, line) => commentedSpots.has(spotKey(side, line))}
                blocksAfter={blocksAfter}
                onPress={onPress}
                onHover={onHover}
                onActivate={onActivate}
              />
            </div>
          )}
          {remaining > 0 ? (
            <div className="flex items-center justify-center gap-2 py-1 text-2xs text-muted-foreground">
              <span className="tabular-nums">
                {Math.min(visibleLines, totalLines)} of {totalLines} lines
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleLines((value) => value + VISIBLE_LINES_STEP)}
              >
                Show {Math.min(VISIBLE_LINES_STEP, remaining)} more lines
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};
