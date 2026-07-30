import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, ExternalLink, MessageSquarePlus } from 'lucide-react';
import { Divider, cn } from '@goodboy/ui';
import { useToast } from '../../../../app/components/Toast';
import type {
  AgentId,
  DiffComment,
  DiffCommentAnchor,
  DiffCommentSide,
  DiffHunkLine,
  FileDiff,
} from '@goodboy/types';
import {
  INITIAL_VISIBLE_LINES,
  LINE_PREFIX,
  STATUS_COLOR,
  STATUS_GLYPH,
  TOOLBAR_ICON_BTN,
  VISIBLE_LINES_STEP,
  anchorKey,
  lineAnchor,
  type ReviewState,
} from './lib';
import { CommentItem } from './comments/CommentItem';
import { InlineComposer } from './comments/InlineComposer';
import { ShowMoreBar } from './ShowMoreBar';
import { SYNTAX_CLASS, highlightLine, languageForPath } from './highlight';

type Props = {
  file: FileDiff;
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

const DIFF_SCROLL_CONTENT_CLASS = 'sticky left-0 box-border w-[var(--diff-card-width)]';

export const FileDiffCard = ({
  file,
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
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(reviewState === 'reviewed');
  const [activeAnchor, setActiveAnchor] = useState<DiffCommentAnchor | null>(null);
  const [fileLevelComposerOpen, setFileLevelComposerOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
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

  const copyPath = () => {
    navigator.clipboard.writeText(file.path).then(
      () => {
        setPathCopied(true);
        showToast('success', 'path copied');
        window.setTimeout(() => setPathCopied(false), 1500);
      },
      () => showToast('error', 'failed to copy path'),
    );
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

  const rows = useMemo(() => {
    const out: Array<
      | { type: 'header'; hi: number; header: string }
      | { type: 'line'; hi: number; li: number; line: DiffHunkLine }
    > = [];
    file.hunks.forEach((hunk, hi) => {
      out.push({ type: 'header', hi, header: hunk.header });
      hunk.lines.forEach((line, li) => out.push({ type: 'line', hi, li, line }));
    });
    return out;
  }, [file]);

  const totalLines = useMemo(() => file.hunks.reduce((n, h) => n + h.lines.length, 0), [file]);

  const lang = useMemo(() => languageForPath(file.path), [file.path]);

  const [visibleLines, setVisibleLines] = useState(INITIAL_VISIBLE_LINES);

  const visibleRows = useMemo(() => {
    if (visibleLines >= totalLines) {
      return rows;
    }
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.type === 'line') {
        count += 1;
        if (count >= visibleLines) {
          return rows.slice(0, i + 1);
        }
      }
    }
    return rows;
  }, [rows, visibleLines, totalLines]);

  const remaining = Math.max(0, totalLines - visibleLines);
  const noteCount = comments.filter((c) => c.status === 'open').length;

  return (
    <section ref={registerRef} data-file-path={file.path} className="min-w-0 max-w-full">
      <div className="sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'expand file' : 'collapse file'}
            aria-label={collapsed ? 'expand file' : 'collapse file'}
            className={TOOLBAR_ICON_BTN}
          >
            <ChevronRight
              size={13}
              aria-hidden
              className={cn(
                'motion-safe:transition-transform duration-150',
                !collapsed && 'rotate-90',
              )}
            />
          </button>
          <span
            className={cn(
              'w-3 shrink-0 text-center font-mono text-[11px] font-bold',
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
            <span
              className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="this file changed since you last reviewed it"
            >
              previously reviewed
            </span>
          ) : null}
          {noteCount > 0 ? (
            <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
            </span>
          ) : null}
          <span className="shrink-0 text-[10px] tabular-nums">
            {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
            {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
            {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={copyPath}
              title="copy path"
              aria-label="copy file path"
              className={TOOLBAR_ICON_BTN}
            >
              {pathCopied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
            </button>
            {canOpenEditor ? (
              <button
                type="button"
                onClick={onOpenInEditor}
                title="open file in editor"
                aria-label="open file in editor"
                className={TOOLBAR_ICON_BTN}
              >
                <ExternalLink size={12} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleToggleReviewed}
              title={isReviewed ? 'mark as not reviewed' : 'mark as reviewed'}
              className={cn(
                'ml-1 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
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
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  file notes
                </span>
                {canComment && !fileLevelComposerOpen ? (
                  <button
                    type="button"
                    onClick={() => setFileLevelComposerOpen(true)}
                    title="add file-level note"
                    aria-label="add file-level note"
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <MessageSquarePlus size={11} aria-hidden />
                  </button>
                ) : null}
              </div>
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
          ) : canComment ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setFileLevelComposerOpen(true)}
                title="add file-level note"
                className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MessageSquarePlus size={10} aria-hidden />
                Add file note
              </button>
            </div>
          ) : null}
          {file.binary ? (
            <p className="py-4 text-center text-xs text-muted-foreground">binary file, no diff</p>
          ) : file.hunks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">no changes</p>
          ) : (
            <div ref={diffScrollRef} className="min-w-0 max-w-full overflow-x-auto">
              <table
                className={cn(
                  'w-max min-w-full border-collapse font-mono text-xs leading-5',
                  drag && 'select-none',
                )}
              >
                <tbody>
                  {visibleRows.map((row) => {
                    if (row.type === 'header') {
                      return (
                        <tr key={`hunk-${row.hi}`}>
                          <td colSpan={4} className="border-y border-border-soft/40 bg-muted/30">
                            <div
                              className={cn(
                                DIFF_SCROLL_CONTENT_CLASS,
                                'px-2.5 py-1 text-[10px] font-medium tabular-nums text-muted-foreground/70',
                              )}
                            >
                              {row.header}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    const { line, hi, li } = row;
                    const anchor = lineAnchor(line);
                    const lineComments = anchor
                      ? (commentsByAnchor.get(anchorKey(anchor)) ?? [])
                      : [];
                    const isActive =
                      anchor !== null &&
                      activeAnchor !== null &&
                      activeAnchor.side === anchor.side &&
                      activeAnchor.lineNumber === anchor.lineNumber;
                    const linePrefix = LINE_PREFIX[line.kind];
                    const rangeCommented = anchor !== null && commentedRange.has(anchorKey(anchor));
                    const selecting = inDrag(anchor);
                    return (
                      <Fragment key={`hunk-${hi}-line-${li}`}>
                        <tr
                          onMouseEnter={() => {
                            if (drag && anchor && anchor.side === drag.side) {
                              setDrag((d) => (d ? { ...d, end: anchor.lineNumber } : d));
                            }
                          }}
                          className={cn(
                            'group',
                            line.kind === 'add' && 'bg-success/[0.07]',
                            line.kind === 'del' && 'bg-danger/[0.07]',
                            selecting && 'bg-primary/15',
                          )}
                        >
                          <td
                            className={cn(
                              'w-6 select-none border-l-2 px-0.5 align-top',
                              rangeCommented
                                ? 'border-warning/60'
                                : line.kind === 'add'
                                  ? 'border-success/50'
                                  : line.kind === 'del'
                                    ? 'border-danger/50'
                                    : 'border-transparent',
                            )}
                          >
                            {canComment && anchor ? (
                              <button
                                type="button"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  setDrag({
                                    side: anchor.side,
                                    start: anchor.lineNumber,
                                    end: anchor.lineNumber,
                                  });
                                }}
                                title="comment on this line (drag to select a range)"
                                aria-label="comment on this line"
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
                                  isActive || selecting
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100',
                                )}
                              >
                                <MessageSquarePlus size={9} aria-hidden />
                              </button>
                            ) : null}
                          </td>
                          <td className="w-9 select-none px-1.5 text-right text-[10px] tabular-nums text-muted-foreground/50">
                            {line.oldLine ?? ''}
                          </td>
                          <td className="w-9 select-none border-r border-border-soft/40 px-1.5 text-right text-[10px] tabular-nums text-muted-foreground/50">
                            {line.newLine ?? ''}
                          </td>
                          <td className="whitespace-pre px-2.5 text-foreground/80">
                            <span
                              aria-hidden
                              className={cn(
                                'select-none',
                                line.kind === 'add'
                                  ? 'text-success'
                                  : line.kind === 'del'
                                    ? 'text-danger'
                                    : 'text-transparent',
                              )}
                            >
                              {linePrefix}
                            </span>
                            {lang
                              ? highlightLine(line.text, lang).map((tok, ti) =>
                                  tok.kind === 'plain' ? (
                                    <Fragment key={ti}>{tok.text}</Fragment>
                                  ) : (
                                    <span key={ti} className={SYNTAX_CLASS[tok.kind]}>
                                      {tok.text}
                                    </span>
                                  ),
                                )
                              : line.text}
                          </td>
                        </tr>
                        {lineComments.length > 0 && (
                          <tr>
                            <td colSpan={4} className="bg-background">
                              <div
                                data-diff-scroll-content
                                className={cn(
                                  DIFF_SCROLL_CONTENT_CLASS,
                                  'flex flex-col gap-1.5 px-3 py-2',
                                )}
                              >
                                {lineComments.map((c) => (
                                  <div key={c.id} className="flex flex-col gap-0.5">
                                    {c.anchor?.endLineNumber ? (
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        lines {c.anchor.lineNumber}–{c.anchor.endLineNumber}
                                      </span>
                                    ) : null}
                                    <CommentItem
                                      comment={c}
                                      onResolve={onResolve}
                                      onReopen={onReopen}
                                      onDelete={onDelete}
                                      onViewAgent={onViewAgent}
                                      getAgentName={getAgentName}
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {isActive && anchor ? (
                          <tr>
                            <td colSpan={4} className="bg-background">
                              <div
                                data-diff-scroll-content
                                className={cn(DIFF_SCROLL_CONTENT_CLASS, 'px-3 py-2')}
                              >
                                <InlineComposer
                                  label={
                                    activeAnchor?.endLineNumber
                                      ? `commenting on lines ${activeAnchor.lineNumber}–${activeAnchor.endLineNumber}`
                                      : `commenting on line ${anchor.lineNumber}`
                                  }
                                  onSubmit={(body) =>
                                    handleSubmitComment(activeAnchor ?? anchor, body)
                                  }
                                  onCancel={() => setActiveAnchor(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {remaining > 0 && (
                <div data-diff-scroll-content className={DIFF_SCROLL_CONTENT_CLASS}>
                  <ShowMoreBar
                    step={Math.min(VISIBLE_LINES_STEP, remaining)}
                    rendered={Math.min(visibleLines, totalLines)}
                    total={totalLines}
                    onShowMore={() => setVisibleLines((n) => n + VISIBLE_LINES_STEP)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
