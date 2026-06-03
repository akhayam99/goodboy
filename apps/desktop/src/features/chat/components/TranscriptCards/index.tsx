import { memo, useEffect, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Copy, FileEdit, ImageOff, Wrench } from 'lucide-react';
import { CopyButton, Divider, Markdown, cn, formatUsd } from '@goodboy/ui';
import type { AgentId, MessageAttachment, SessionId } from '@goodboy/types';
import { extractCommentResolved, isReviewThreadId } from '@goodboy/core';
import type { TranscriptItem } from '../../utils/transcript-items';
import { readAttachment } from '../../turn';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { ImageLightbox } from '../ImageLightbox';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { displayPath } from '../../../../shared/utils/display-path';
import { HandoffChip } from '../HandoffChip';
import { CommentResolvedChip } from '../CommentResolvedChip';

const EDIT_LABEL: Record<'create' | 'modify' | 'delete', string> = {
  create: 'created',
  modify: 'modified',
  delete: 'deleted',
};

interface TranscriptCardProps {
  readonly item: TranscriptItem;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
}

function TranscriptCardImpl({
  item,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
}: TranscriptCardProps) {
  switch (item.kind) {
    case 'user_text':
      return (
        <UserText
          text={item.text}
          at={item.at}
          attachments={item.attachments}
          workingDir={workingDir}
        />
      );
    case 'assistant_text':
      return <AssistantText text={item.text} sessionId={sessionId} />;
    case 'tool_call':
      return <ToolCall item={item} />;
    case 'file_edit':
      return (
        <FileEditBlock
          path={item.path}
          editType={item.editType}
          workingDir={workingDir}
          onOpenDiff={onOpenDiff}
        />
      );
    case 'usage':
      return (
        <p className="text-xs text-muted-foreground/70">
          {formatTokens(item.usage.inputTokens)} in / {formatTokens(item.usage.outputTokens)} out
          {item.usage.cachedInputTokens > 0
            ? ` · ${formatTokens(item.usage.cachedInputTokens)} cached`
            : ''}
          {item.usage.estimatedCostUsd > 0 ? ` · ~${formatUsd(item.usage.estimatedCostUsd)}` : ''}
        </p>
      );
    case 'error':
      return (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {item.message}
        </div>
      );
    case 'auth_required':
      return (
        <AuthRequiredCallout
          providerId={item.providerId}
          identity={item.identity}
          onRefresh={onRefreshAuth ?? (() => undefined)}
        />
      );
    case 'skill_invocation':
      return <SkillInvocationCard item={item} />;
    case 'step_transition':
      return <PhaseTransitionCard item={item} />;
    case 'done':
      return <Divider />;
    case 'permission_request':
      return <PermissionRequestCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'permission_decision':
      return <PermissionDecisionCard item={item} sessionId={sessionId} agentId={agentId} />;
  }
}

// Content-aware comparator: reduceTranscript allocates fresh items every call,
// so reference equality on `item` is always false. Skipping re-render when the
// rendered output would be identical avoids costly Markdown/CopyButton work for
// 100+ static cards on session switch and during streaming updates.
function itemEqual(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind || a.key !== b.key) return false;
  if (a.kind === 'tool_call' && b.kind === 'tool_call') {
    return a.ended === b.ended && a.isError === b.isError && a.output === b.output;
  }
  if (a.kind === 'assistant_text' && b.kind === 'assistant_text') {
    return a.text === b.text;
  }
  return true;
}

export const TranscriptCard = memo(
  TranscriptCardImpl,
  (prev, next) =>
    itemEqual(prev.item, next.item) &&
    prev.sessionId === next.sessionId &&
    prev.agentId === next.agentId &&
    prev.workingDir === next.workingDir &&
    prev.onRefreshAuth === next.onRefreshAuth &&
    prev.onOpenDiff === next.onOpenDiff,
);

interface FileEditBlockProps {
  path: string;
  editType: 'create' | 'modify' | 'delete';
  workingDir?: string | null;
  onOpenDiff?: (filePath: string) => void;
}

function FileEditBlock({ path, editType, workingDir, onOpenDiff }: FileEditBlockProps) {
  const rel = displayPath(path, workingDir);
  const inner = (
    <>
      <FileEdit size={11} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="text-2xs uppercase tracking-wide text-info/80">{EDIT_LABEL[editType]}</span>
      <code className="min-w-0 truncate font-mono text-xs text-foreground/80" title={path}>
        {rel}
      </code>
      {onOpenDiff ? (
        <ArrowUpRight
          size={11}
          aria-hidden
          className="ml-auto shrink-0 text-info/60 opacity-0 transition-opacity group-hover:opacity-100"
        />
      ) : null}
    </>
  );

  if (onOpenDiff) {
    return (
      <button
        type="button"
        onClick={() => onOpenDiff(path)}
        title="open diff"
        aria-label={`open the diff for ${rel}`}
        className="group inline-flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-md border border-info/30 bg-info/5 px-2 py-1 transition-colors hover:border-info/50 hover:bg-info/10"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="group inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-info/30 bg-info/5 px-2 py-1">
      {inner}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

const HANDOFF_MARKER_RE = /<<handoff\s+[^>]+?>>/g;
const COMMENT_RESOLVED_MARKER_RE = /<<comment-resolved\s+[^>]+?>>/g;

function AssistantText({ text, sessionId }: { text: string; sessionId: SessionId | null }) {
  const displayText = text
    .replace(HANDOFF_MARKER_RE, '')
    .replace(COMMENT_RESOLVED_MARKER_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // The comment-resolved chip lives in the top-right of its own row and
  // hovers a primary action. The hover-only copy button positioned at the
  // same corner of the assistant bubble crashes into that primary action
  // on short messages, and copying the marker prose isn't useful anyway.
  // Hide copy when the marker is present.
  const resolvedMarker = extractCommentResolved(text);
  const hasCommentResolvedMarker =
    resolvedMarker !== null && isReviewThreadId(resolvedMarker.threadId);
  return (
    <div className="group relative rounded-md bg-subtle/40 px-3 py-2 text-[13px]">
      {hasCommentResolvedMarker ? null : (
        <div className="absolute -right-1 -top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
          <CopyButton value={text} label="message" />
        </div>
      )}
      <Markdown text={displayText} />
      {sessionId ? (
        <>
          <HandoffChip assistantText={text} sessionId={sessionId} />
          <CommentResolvedChip assistantText={text} sessionId={sessionId} />
        </>
      ) : null}
    </div>
  );
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function InlineCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={(e) => void onCopy(e)}
      title={copied ? 'copied' : 'copy message'}
      aria-label="copy message"
      className="rounded p-0.5 text-foreground/60 transition-colors hover:bg-primary/20 hover:text-foreground"
    >
      {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
    </button>
  );
}

// Loads a persisted attachment lazily: the bytes live on disk in the worktree,
// not in the turn-event payload, so each thumbnail reads its own file. Works
// the same for a just-sent message and one restored from the DB after restart.
function AttachmentThumb({
  attachment,
  workingDir,
}: {
  attachment: MessageAttachment;
  workingDir: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!workingDir) {
      setFailed(true);
      return;
    }
    let alive = true;
    setFailed(false);
    setSrc(null);
    readAttachment(workingDir, attachment.relPath)
      .then((dataUrl) => {
        if (alive) setSrc(dataUrl);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [workingDir, attachment.relPath]);

  if (failed) {
    return (
      <div
        className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg bg-foreground/5 text-muted-foreground"
        title={attachment.fileName}
      >
        <ImageOff size={16} aria-hidden />
        <span className="max-w-[6.5rem] truncate px-1 text-2xs">{attachment.fileName}</span>
      </div>
    );
  }

  if (src === null) {
    return <div className="h-28 w-28 animate-pulse rounded-lg bg-foreground/10" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        title={`preview ${attachment.fileName}`}
        aria-label={`preview ${attachment.fileName}`}
        className="cursor-zoom-in"
      >
        <img
          src={src}
          alt={attachment.fileName}
          className="max-h-60 max-w-full rounded-lg object-contain ring-1 ring-primary/20"
        />
      </button>
      {previewOpen ? (
        <ImageLightbox src={src} alt={attachment.fileName} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </>
  );
}

function UserText({
  text,
  at,
  attachments,
  workingDir = null,
}: {
  text: string;
  at: string;
  attachments?: ReadonlyArray<MessageAttachment>;
  workingDir?: string | null;
}) {
  const images = attachments ?? [];
  return (
    <div className="ml-auto flex w-fit max-w-[85%] flex-col gap-1.5 rounded-md border border-primary/10 bg-primary/15 px-4 pb-1.5 pt-2.5">
      {images.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {images.map((a) => (
            <AttachmentThumb key={a.id} attachment={a} workingDir={workingDir} />
          ))}
        </div>
      ) : null}
      {text.length > 0 ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
      ) : null}
      <div className="flex items-center justify-end gap-1.5 text-2xs text-foreground/55">
        <span className="font-mono">{formatHHMM(at)}</span>
        {text.length > 0 ? <InlineCopyButton value={text} /> : null}
      </div>
    </div>
  );
}

function ToolCall({ item }: { item: Extract<TranscriptItem, { kind: 'tool_call' }> }) {
  const [open, setOpen] = useState(false);
  const running = !item.ended;
  const accent = (() => {
    if (item.isError) return 'text-danger';
    if (running) return 'text-muted-foreground/70';
    return 'text-muted-foreground';
  })();

  return (
    <div className="group">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs motion-safe:transition-colors hover:bg-muted/60',
          item.isError && 'text-danger',
        )}
      >
        <ChevronRight
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground/60 motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        />
        <Wrench size={11} aria-hidden className={cn('shrink-0', accent)} />
        <span className="font-mono text-muted-foreground">{item.toolName}</span>
        {running ? (
          <span className="flex shrink-0 gap-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
          </span>
        ) : item.isError ? (
          <span className="text-2xs uppercase tracking-wide text-danger">error</span>
        ) : null}
      </button>
      {open ? (
        <div className="ml-[1.125rem] mt-0.5 flex min-w-0 flex-col gap-1">
          <pre className="min-w-0 whitespace-pre-wrap break-words border-l-2 border-primary/30 p-1.5 font-mono text-xs text-muted-foreground">
            input: {JSON.stringify(item.input, null, 2)}
          </pre>
          {item.ended ? (
            <pre className="min-w-0 whitespace-pre-wrap break-words border-l-2 border-primary/30 p-1.5 font-mono text-xs text-muted-foreground">
              output: {JSON.stringify(item.output, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
