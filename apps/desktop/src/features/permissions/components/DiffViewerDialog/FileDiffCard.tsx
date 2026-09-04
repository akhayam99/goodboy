import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, ExternalLink, MessageSquarePlus } from 'lucide-react';
import { Chip, cn, type DiffLayoutMode, Divider, EmptyState, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { CopyButton } from '@goodboy/ui';
import type {
  AgentId,
  DiffComment,
  DiffCommentAnchor,
  DiffCommentSide,
  DiffHunkLine,
  FileDiff,
} from '@goodboy/types';
import { buildDiffPairRows, type DiffPairRow } from '../../../../shared/utils/diffPairRows';
import { buildDiffRows, type DiffRow } from '../../../../shared/utils/diffRows';
import { visibleDiffRows } from '../../../../shared/utils/visibleDiffRows';
import {
  DIFF_SCROLL_CONTENT_CLASS,
  INITIAL_VISIBLE_LINES,
  STATUS_COLOR,
  STATUS_GLYPH,
  TOOLBAR_ICON_BTN,
  VISIBLE_LINES_STEP,
  anchorKey,
  type ReviewState,
} from './lib';
import { CommentItem } from './comments/CommentItem';
import { InlineComposer } from './comments/InlineComposer';
import { DiffCommentThreadRow } from './DiffCommentThreadRow';
import { DiffComposerRow } from './DiffComposerRow';
import { DiffLineText } from './DiffLineText';
import { DiffPairCells } from './DiffPairCells';
import { SplitDiffColumns } from './SplitDiffColumns';
import { ShowMoreBar } from './ShowMoreBar';
import { languageForPath } from './highlight';

type Props = {
  file: FileDiff;
  layoutMode: DiffLayoutMode;
  registerRef: (el: HTMLElement | null) => void;
  reviewState: ReviewState;
  onToggleReviewed: (next: boolean) => void;
  canOpenEditor: boolean;
  onOpenInEditor: () => void;
  comments: ReadonlyArray<DiffComment>;
  canComment: boolean;
  onAddComment: (anchor: DiffCommentAnchor, body: string) => void;
  onAddFileLevelComment: (body: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
};

type SideAnchorParams = {
  line: DiffHunkLine | null;
  side: DiffCommentSide;
};

const anchorOfSide = ({ line, side }: SideAnchorParams): DiffCommentAnchor | null => {
  const lineNumber = side === 'old' ? line?.oldLine : line?.newLine;
  if (lineNumber == null) {
    return null;
  }
  return { side, lineNumber };
};

type AnchorParams = {
  anchor: DiffCommentAnchor | null;
};

type AnchorPairParams = {
  oldAnchor: DiffCommentAnchor | null;
  newAnchor: DiffCommentAnchor | null;
};

export const FileDiffCard = ({
  file,
  layoutMode,
  registerRef,
  reviewState,
  onToggleReviewed,
  canOpenEditor,
  onOpenInEditor,
  comments,
  canComment,
  onAddComment,
  onAddFileLevelComment,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: Props) => {
  const [collapsed, setCollapsed] = useState(reviewState === 'reviewed');
  const [activeAnchor, setActiveAnchor] = useState<DiffCommentAnchor | null>(null);
  const [fileLevelComposerOpen, setFileLevelComposerOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const diffScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scrollContainer = diffScrollRef.current;
    if (scrollContainer == null) {
      return;
    }
    scrollContainer.style.setProperty('--diff-card-width', `${scrollContainer.clientWidth}px`);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      scrollContainer.style.setProperty('--diff-card-width', `${scrollContainer.clientWidth}px`);
    });
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, [collapsed]);

  const isReviewed = reviewState === 'reviewed';
  const handleToggleReviewed = () => {
    const next = !isReviewed;
    onToggleReviewed(next);
    setCollapsed(next);
  };

  const resolvedCount = useMemo(
    () => comments.filter((c) => c.status === 'resolved').length,
    [comments],
  );
  const visibleComments = useMemo(
    () => (showResolved ? comments : comments.filter((c) => c.status !== 'resolved')),
    [comments, showResolved],
  );
  const fileLevelComments = useMemo(
    () => visibleComments.filter((c) => !c.anchor),
    [visibleComments],
  );

  const commentsByAnchor = useMemo(() => {
    const m = new Map<string, DiffComment[]>();
    for (const c of visibleComments) {
      if (!c.anchor) {
        continue;
      }
      const k = anchorKey(c.anchor);
      const arr = m.get(k);
      if (arr) {
        arr.push(c);
      } else {
        m.set(k, [c]);
      }
    }
    return m;
  }, [visibleComments]);

  const commentedRange = useMemo(() => {
    const set = new Set<string>();
    for (const c of comments) {
      if (!c.anchor?.endLineNumber || c.status === 'resolved') {
        continue;
      }
      for (let n = c.anchor.lineNumber; n <= c.anchor.endLineNumber; n++) {
        set.add(`${c.anchor.side}:${n}`);
      }
    }
    return set;
  }, [comments]);

  const [drag, setDrag] = useState<{ side: DiffCommentSide; start: number; end: number } | null>(
    null,
  );
  const dragLo = drag ? Math.min(drag.start, drag.end) : 0;
  const dragHi = drag ? Math.max(drag.start, drag.end) : 0;
  const inDrag = (a: DiffCommentAnchor | null): boolean =>
    drag !== null &&
    a !== null &&
    a.side === drag.side &&
    a.lineNumber >= dragLo &&
    a.lineNumber <= dragHi;

  useEffect(() => {
    if (!drag) {
      return;
    }
    const onUp = () => {
      const lo = Math.min(drag.start, drag.end);
      const hi = Math.max(drag.start, drag.end);
      setActiveAnchor({
        side: drag.side,
        lineNumber: lo,
        ...(hi > lo ? { endLineNumber: hi } : {}),
      });
      setDrag(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [drag]);

  const handleSubmitComment = (anchor: DiffCommentAnchor, body: string) => {
    onAddComment(anchor, body);
    setActiveAnchor(null);
  };
  const handleSubmitFileLevel = (body: string) => {
    onAddFileLevelComment(body);
    setFileLevelComposerOpen(false);
  };

  const startDrag = (anchor: DiffCommentAnchor) => {
    setDrag({ side: anchor.side, start: anchor.lineNumber, end: anchor.lineNumber });
  };

  const extendDrag = ({ oldAnchor, newAnchor }: AnchorPairParams) => {
    if (drag === null) {
      return;
    }
    const hoverAnchor = drag.side === 'old' ? oldAnchor : newAnchor;
    if (hoverAnchor === null) {
      return;
    }
    setDrag((current) => (current === null ? null : { ...current, end: hoverAnchor.lineNumber }));
  };

  const isAnchorActive = ({ anchor }: AnchorParams): boolean =>
    anchor !== null &&
    activeAnchor !== null &&
    activeAnchor.side === anchor.side &&
    activeAnchor.lineNumber === anchor.lineNumber;

  const isRangeCommented = ({ anchor }: AnchorParams): boolean =>
    anchor !== null && commentedRange.has(anchorKey(anchor));

  const anchoredComments = ({
    oldAnchor,
    newAnchor,
  }: AnchorPairParams): ReadonlyArray<DiffComment> => [
    ...(oldAnchor === null ? [] : (commentsByAnchor.get(anchorKey(oldAnchor)) ?? [])),
    ...(newAnchor === null ? [] : (commentsByAnchor.get(anchorKey(newAnchor)) ?? [])),
  ];

  const isSplit = layoutMode === 'split';
  const columnCount = isSplit ? 4 : 3;

  const rows = useMemo<ReadonlyArray<DiffRow | DiffPairRow>>(
    () =>
      isSplit ? buildDiffPairRows({ hunks: file.hunks }) : buildDiffRows({ hunks: file.hunks }),
    [file.hunks, isSplit],
  );

  const totalLines = useMemo(() => file.hunks.reduce((n, h) => n + h.lines.length, 0), [file]);

  const lang = useMemo(() => languageForPath(file.path), [file.path]);

  const [visibleLines, setVisibleLines] = useState(INITIAL_VISIBLE_LINES);

  const visibleRows = useMemo(() => visibleDiffRows({ rows, visibleLines }), [rows, visibleLines]);

  const remaining = Math.max(0, totalLines - visibleLines);
  const noteCount = comments.filter((c) => c.status === 'open').length;

  return (
    <section ref={registerRef} data-file-path={file.path} className="min-w-0 max-w-full">
      <div className="sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Tooltip content={collapsed ? 'Expand file' : 'Collapse file'}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand file' : 'Collapse file'}
              className={TOOLBAR_ICON_BTN}
            >
              <ChevronRight
                size={ICON_SIZE.row}
                aria-hidden
                className={cn(
                  'motion-safe:transition-transform duration-150',
                  !collapsed && 'rotate-90',
                )}
              />
            </button>
          </Tooltip>
          <span
            className={cn(
              'w-3 shrink-0 text-center font-mono text-2xs font-bold',
              STATUS_COLOR[file.status],
            )}
            title={file.status}
          >
            {STATUS_GLYPH[file.status]}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="min-w-0 flex-1 truncate text-left font-mono text-xs text-foreground"
            title={file.path}
          >
            {file.path}
          </button>
          {reviewState === 'stale' ? (
            <Chip
              tone="neutral"
              size="3xs"
              bordered={false}
              label="previously reviewed"
              title="This file changed since you last reviewed it"
              className="shrink-0"
            />
          ) : null}
          {noteCount > 0 ? (
            <Chip
              tone="warning"
              size="3xs"
              bordered={false}
              label={`${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`}
              className="shrink-0"
            />
          ) : null}
          <span className="shrink-0 text-3xs tabular-nums">
            {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
            {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
            {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip content="copy path">
              <CopyButton
                presentation="icon"
                value={file.path}
                label="copy file path"
                size={ICON_SIZE.row}
                className={TOOLBAR_ICON_BTN}
              />
            </Tooltip>
            {canOpenEditor ? (
              <Tooltip content="open file in editor">
                <button
                  type="button"
                  onClick={onOpenInEditor}
                  aria-label="Open file in editor"
                  className={TOOLBAR_ICON_BTN}
                >
                  <ExternalLink size={ICON_SIZE.row} aria-hidden />
                </button>
              </Tooltip>
            ) : null}
            {canComment ? (
              <Tooltip content="add file note">
                <button
                  type="button"
                  onClick={() => {
                    setCollapsed(false);
                    setFileLevelComposerOpen(true);
                  }}
                  aria-label="Add file note"
                  className={TOOLBAR_ICON_BTN}
                >
                  <MessageSquarePlus size={ICON_SIZE.row} aria-hidden />
                </button>
              </Tooltip>
            ) : null}
            <button
              type="button"
              onClick={handleToggleReviewed}
              title={isReviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-3xs font-medium transition-colors',
                isReviewed
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-3 items-center justify-center rounded-[3px] border',
                  isReviewed
                    ? 'border-success bg-success text-background'
                    : 'border-muted-foreground/50',
                )}
              >
                {isReviewed ? <Check size={8} aria-hidden /> : null}
              </span>
              Viewed
            </button>
          </div>
        </div>
        <Divider />
      </div>
      {collapsed ? null : (
        <div className="p-3">
          {resolvedCount > 0 ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-3xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight
                  size={10}
                  aria-hidden
                  className={cn(
                    'motion-safe:transition-transform duration-150',
                    showResolved && 'rotate-90',
                  )}
                />
                {showResolved ? 'hide' : 'show'} {resolvedCount} resolved{' '}
                {resolvedCount === 1 ? 'comment' : 'comments'}
              </button>
            </div>
          ) : null}
          {fileLevelComments.length > 0 || fileLevelComposerOpen ? (
            <div className="mb-3 flex flex-col gap-1.5">
              <span className="text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                file notes
              </span>
              {fileLevelComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onResolve={onResolve}
                  onReopen={onReopen}
                  onDelete={onDelete}
                  onViewAgent={onViewAgent}
                  getAgentName={getAgentName}
                />
              ))}
              {fileLevelComposerOpen ? (
                <InlineComposer
                  onSubmit={handleSubmitFileLevel}
                  onCancel={() => setFileLevelComposerOpen(false)}
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
              ref={diffScrollRef}
              className={cn('min-w-0 max-w-full', isSplit ? undefined : 'overflow-x-auto')}
            >
              <table
                className={cn(
                  'border-collapse font-mono text-xs leading-5',
                  isSplit ? 'w-full table-fixed' : 'w-max min-w-full',
                  drag && 'select-none',
                )}
              >
                {isSplit ? <SplitDiffColumns variant="viewer" /> : null}
                <tbody>
                  {visibleRows.map((row) => {
                    if (row.type === 'header') {
                      return (
                        <tr key={`hunk-${row.hunkIndex}`}>
                          <td
                            colSpan={columnCount}
                            className="border-y border-border-soft/40 bg-muted/30"
                          >
                            <div
                              className={cn(
                                isSplit ? undefined : DIFF_SCROLL_CONTENT_CLASS,
                                'px-2.5 py-1 text-3xs font-medium tabular-nums text-muted-foreground/70',
                              )}
                            >
                              {row.header}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    if (row.type === 'pair') {
                      const { pair, hunkIndex, rowIndex } = row;
                      const oldAnchor = anchorOfSide({ line: pair.old, side: 'old' });
                      const newAnchor = anchorOfSide({ line: pair.new, side: 'new' });
                      const pairComments = anchoredComments({ oldAnchor, newAnchor });
                      const isActive =
                        isAnchorActive({ anchor: oldAnchor }) ||
                        isAnchorActive({ anchor: newAnchor });
                      return (
                        <Fragment key={`hunk-${hunkIndex}-pair-${rowIndex}`}>
                          <tr onMouseEnter={() => extendDrag({ oldAnchor, newAnchor })}>
                            <DiffPairCells
                              pair={pair}
                              lang={lang}
                              canComment={canComment}
                              oldAnchor={oldAnchor}
                              newAnchor={newAnchor}
                              oldRangeCommented={isRangeCommented({ anchor: oldAnchor })}
                              newRangeCommented={isRangeCommented({ anchor: newAnchor })}
                              selectingOld={inDrag(drag?.side === 'old' ? oldAnchor : null)}
                              selectingNew={inDrag(drag?.side === 'new' ? newAnchor : null)}
                              onStartDrag={startDrag}
                              onActivate={setActiveAnchor}
                            />
                          </tr>
                          {pairComments.length > 0 && (
                            <DiffCommentThreadRow
                              comments={pairComments}
                              colSpan={columnCount}
                              onResolve={onResolve}
                              onReopen={onReopen}
                              onDelete={onDelete}
                              onViewAgent={onViewAgent}
                              getAgentName={getAgentName}
                            />
                          )}
                          {isActive && activeAnchor !== null ? (
                            <DiffComposerRow
                              anchor={activeAnchor}
                              colSpan={columnCount}
                              onSubmit={(body) => handleSubmitComment(activeAnchor, body)}
                              onCancel={() => setActiveAnchor(null)}
                            />
                          ) : null}
                        </Fragment>
                      );
                    }
                    const { line, hunkIndex, rowIndex } = row;
                    const oldAnchor = anchorOfSide({ line, side: 'old' });
                    const newAnchor = anchorOfSide({ line, side: 'new' });
                    const lineComments = anchoredComments({ oldAnchor, newAnchor });
                    const isActive =
                      isAnchorActive({ anchor: oldAnchor }) ||
                      isAnchorActive({ anchor: newAnchor });
                    const oldRangeCommented = isRangeCommented({ anchor: oldAnchor });
                    const dragAnchor =
                      drag?.side === 'old' ? oldAnchor : drag?.side === 'new' ? newAnchor : null;
                    const selecting = inDrag(dragAnchor);
                    return (
                      <Fragment key={`hunk-${hunkIndex}-line-${rowIndex}`}>
                        <tr
                          onMouseEnter={() => extendDrag({ oldAnchor, newAnchor })}
                          className={cn(
                            line.kind === 'add' && 'bg-success/[0.07]',
                            line.kind === 'del' && 'bg-danger/[0.07]',
                            selecting && 'bg-primary/15',
                          )}
                        >
                          <td
                            onPointerDown={
                              canComment && oldAnchor !== null
                                ? (event) => {
                                    event.preventDefault();
                                    startDrag(oldAnchor);
                                  }
                                : undefined
                            }
                            onKeyDown={
                              canComment && oldAnchor !== null
                                ? (event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') {
                                      return;
                                    }
                                    event.preventDefault();
                                    setActiveAnchor(oldAnchor);
                                  }
                                : undefined
                            }
                            role={canComment && oldAnchor !== null ? 'button' : undefined}
                            tabIndex={canComment && oldAnchor !== null ? 0 : undefined}
                            aria-label={
                              canComment && line.oldLine !== null
                                ? `comment on old line ${line.oldLine}`
                                : undefined
                            }
                            className={cn(
                              'w-9 select-none border-l-2 px-1.5 text-right text-3xs tabular-nums text-muted-foreground/50',
                              canComment &&
                                oldAnchor !== null &&
                                'cursor-pointer transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60',
                              oldRangeCommented
                                ? 'border-warning/60'
                                : line.kind === 'add'
                                  ? 'border-success/50'
                                  : line.kind === 'del'
                                    ? 'border-danger/50'
                                    : 'border-transparent',
                            )}
                          >
                            {line.oldLine ?? ''}
                          </td>
                          <td
                            onPointerDown={
                              canComment && newAnchor !== null
                                ? (event) => {
                                    event.preventDefault();
                                    startDrag(newAnchor);
                                  }
                                : undefined
                            }
                            onKeyDown={
                              canComment && newAnchor !== null
                                ? (event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') {
                                      return;
                                    }
                                    event.preventDefault();
                                    setActiveAnchor(newAnchor);
                                  }
                                : undefined
                            }
                            role={canComment && newAnchor !== null ? 'button' : undefined}
                            tabIndex={canComment && newAnchor !== null ? 0 : undefined}
                            aria-label={
                              canComment && line.newLine !== null
                                ? `comment on new line ${line.newLine}`
                                : undefined
                            }
                            className={cn(
                              'w-9 select-none border-r border-border-soft/40 px-1.5 text-right text-3xs tabular-nums text-muted-foreground/50',
                              canComment &&
                                newAnchor !== null &&
                                'cursor-pointer transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60',
                            )}
                          >
                            {line.newLine ?? ''}
                          </td>
                          <td className="whitespace-pre px-2.5 text-foreground/80">
                            <DiffLineText line={line} lang={lang} />
                          </td>
                        </tr>
                        {lineComments.length > 0 && (
                          <DiffCommentThreadRow
                            comments={lineComments}
                            colSpan={columnCount}
                            onResolve={onResolve}
                            onReopen={onReopen}
                            onDelete={onDelete}
                            onViewAgent={onViewAgent}
                            getAgentName={getAgentName}
                          />
                        )}
                        {isActive && activeAnchor !== null ? (
                          <DiffComposerRow
                            anchor={activeAnchor}
                            colSpan={columnCount}
                            onSubmit={(body) => handleSubmitComment(activeAnchor, body)}
                            onCancel={() => setActiveAnchor(null)}
                          />
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {remaining > 0 && (
                    <tr>
                      <td colSpan={columnCount}>
                        <div data-diff-scroll-content className={DIFF_SCROLL_CONTENT_CLASS}>
                          <ShowMoreBar
                            step={Math.min(VISIBLE_LINES_STEP, remaining)}
                            rendered={Math.min(visibleLines, totalLines)}
                            total={totalLines}
                            onShowMore={() => setVisibleLines((n) => n + VISIBLE_LINES_STEP)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
