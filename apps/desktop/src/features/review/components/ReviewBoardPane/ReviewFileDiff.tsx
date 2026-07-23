import { Fragment, useMemo, useState } from 'react';
import { Bot, ChevronRight, MessageSquarePlus } from 'lucide-react';
import { Divider, cn } from '@goodboy/ui';
import type { DiffHunkLine, FileDiff, PrReviewDraft, ReviewDraftSide } from '@goodboy/types';
import {
  INITIAL_VISIBLE_LINES,
  LINE_PREFIX,
  STATUS_COLOR,
  STATUS_GLYPH,
  VISIBLE_LINES_STEP,
} from '../../../permissions/components/DiffViewerDialog/lib';
import { ShowMoreBar } from '../../../permissions/components/DiffViewerDialog/ShowMoreBar';
import {
  SYNTAX_CLASS,
  highlightLine,
  languageForPath,
} from '../../../permissions/components/DiffViewerDialog/highlight';
import { LineComposer } from './LineComposer';

export type ReviewLineTarget = {
  readonly path: string;
  readonly line: number;
  readonly side: ReviewDraftSide;
  readonly text: string;
};

type Props = {
  readonly file: FileDiff;
  readonly drafts: ReadonlyArray<PrReviewDraft>;
  readonly onAddDraft: (target: ReviewLineTarget, body: string) => void;
  readonly onAskAgent: (target: ReviewLineTarget) => void;
};

type LineAnchor = {
  readonly side: ReviewDraftSide;
  readonly line: number;
};

const anchorOf = (line: DiffHunkLine): LineAnchor | null => {
  if (line.newLine != null) {
    return { side: 'new', line: line.newLine };
  }
  if (line.oldLine != null) {
    return { side: 'old', line: line.oldLine };
  }
  return null;
};

const anchorKeyOf = (anchor: LineAnchor): string => `${anchor.side}:${anchor.line}`;

export const ReviewFileDiff = ({ file, drafts, onAddDraft, onAskAgent }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<LineAnchor | null>(null);
  const [visibleLines, setVisibleLines] = useState(INITIAL_VISIBLE_LINES);

  const draftedKeys = useMemo(
    () => new Set(drafts.map((draft) => `${draft.side}:${draft.line}`)),
    [drafts],
  );

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

  const lang = useMemo(() => languageForPath(file.path), [file.path]);
  const remaining = Math.max(0, totalLines - visibleLines);

  return (
    <section data-file-path={file.path}>
      <div className="sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'expand file' : 'collapse file'}
            aria-label={collapsed ? 'expand file' : 'collapse file'}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              size={13}
              aria-hidden
              className={cn(
                'duration-150 motion-safe:transition-transform',
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
            onClick={() => setCollapsed((value) => !value)}
            className="min-w-0 flex-1 truncate text-left font-mono text-xs text-foreground"
            title={file.path}
          >
            {file.path}
          </button>
          {drafts.length > 0 ? (
            <span className="shrink-0 rounded-full bg-indigo-400/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
              {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
            </span>
          ) : null}
          <span className="shrink-0 text-[10px] tabular-nums">
            {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
            {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
            {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
          </span>
        </div>
        <Divider />
      </div>
      {collapsed ? null : (
        <div className="p-3">
          {file.binary ? (
            <p className="py-4 text-center text-xs text-muted-foreground">binary file, no diff</p>
          ) : file.hunks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">no changes</p>
          ) : (
            <>
              <table className="w-full border-collapse font-mono text-xs leading-5">
                <tbody>
                  {visibleRows.map((row) => {
                    if (row.type === 'header') {
                      return (
                        <tr key={`hunk-${row.hi}`}>
                          <td
                            colSpan={4}
                            className="border-y border-border-soft/40 bg-muted/30 px-2.5 py-1 text-[10px] font-medium tabular-nums text-muted-foreground/70"
                          >
                            {row.header}
                          </td>
                        </tr>
                      );
                    }
                    const { line, hi, li } = row;
                    const anchor = anchorOf(line);
                    const target: ReviewLineTarget | null =
                      anchor == null
                        ? null
                        : { path: file.path, line: anchor.line, side: anchor.side, text: line.text };
                    const isActive =
                      anchor != null &&
                      activeAnchor != null &&
                      activeAnchor.side === anchor.side &&
                      activeAnchor.line === anchor.line;
                    const hasDraft = anchor != null && draftedKeys.has(anchorKeyOf(anchor));
                    return (
                      <Fragment key={`hunk-${hi}-line-${li}`}>
                        <tr
                          className={cn(
                            'group',
                            line.kind === 'add' && 'bg-success/[0.07]',
                            line.kind === 'del' && 'bg-danger/[0.07]',
                            hasDraft && 'bg-indigo-400/[0.08]',
                          )}
                        >
                          <td
                            className={cn(
                              'w-11 select-none border-l-2 px-0.5 align-top',
                              hasDraft
                                ? 'border-indigo-400/70'
                                : line.kind === 'add'
                                  ? 'border-success/50'
                                  : line.kind === 'del'
                                    ? 'border-danger/50'
                                    : 'border-transparent',
                            )}
                          >
                            {target != null ? (
                              <span className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveAnchor(isActive ? null : (anchor ?? null))
                                  }
                                  title="draft a comment on this line"
                                  aria-label={`draft a comment on line ${target.line}`}
                                  className={cn(
                                    'flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
                                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                  )}
                                >
                                  <MessageSquarePlus size={9} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAskAgent(target)}
                                  title="ask the agent about this line"
                                  aria-label={`ask the agent about line ${target.line}`}
                                  className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                                >
                                  <Bot size={9} aria-hidden />
                                </button>
                              </span>
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
                              {LINE_PREFIX[line.kind]}
                            </span>
                            {lang
                              ? highlightLine(line.text, lang).map((token, ti) =>
                                  token.kind === 'plain' ? (
                                    <Fragment key={ti}>{token.text}</Fragment>
                                  ) : (
                                    <span key={ti} className={SYNTAX_CLASS[token.kind]}>
                                      {token.text}
                                    </span>
                                  ),
                                )
                              : line.text}
                          </td>
                        </tr>
                        {isActive && target != null ? (
                          <tr>
                            <td colSpan={4} className="bg-background px-3 py-2">
                              <LineComposer
                                label={`Commenting on ${file.path}:${target.line}`}
                                onSubmit={(body) => {
                                  onAddDraft(target, body);
                                  setActiveAnchor(null);
                                }}
                                onCancel={() => setActiveAnchor(null)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {remaining > 0 && (
                <ShowMoreBar
                  step={Math.min(VISIBLE_LINES_STEP, remaining)}
                  rendered={Math.min(visibleLines, totalLines)}
                  total={totalLines}
                  onShowMore={() => setVisibleLines((value) => value + VISIBLE_LINES_STEP)}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
