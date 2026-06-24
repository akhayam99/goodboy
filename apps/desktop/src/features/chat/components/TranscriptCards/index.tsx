import { memo, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, FileEdit, ImageOff } from 'lucide-react';
import { CopyButton, Divider, Markdown, Skeleton, cn, formatUsd } from '@goodboy/ui';
import type { AgentId, MessageAttachment, ProviderId, SessionId } from '@goodboy/types';
import { extractCommentResolved, isReviewThreadId, stripControlMarkers } from '@goodboy/core';
import type { TranscriptItem } from '../../utils/transcript-items';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { PROVIDER_LABEL, modelLabel } from '../../utils/chat-constants';
import { readAttachment } from '../../turn';
import { fileIconFor } from '../../attachment-kinds';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { ImageLightbox } from '../ImageLightbox';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { displayPath } from '../../../../shared/utils/display-path';
import { HandoffChip } from '../HandoffChip';
import { CommentResolvedChip } from '../CommentResolvedChip';
import { CommentWontfixChip } from '../CommentWontfixChip';
import { PlanChip } from '../PlanChip';
import { ClustersCard } from '../ClustersCard';
import { ToolCallCard } from '../ToolCallCard';

const EDIT_LABEL: Record<'create' | 'modify' | 'delete', string> = {
  create: 'created',
  modify: 'modified',
  delete: 'deleted',
};

type TranscriptCardProps = {
  readonly item: TranscriptItem;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
};

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
          provider={item.provider}
          model={item.model}
          workingDir={workingDir}
        />
      );
    case 'assistant_text':
      return <AssistantText text={item.text} sessionId={sessionId} />;
    case 'tool_call':
      return <ToolCallCard item={item} />;
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
      return <UsageRow usage={item.usage} />;
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
    case 'oq_answer':
      return null;
    case 'done':
      return <Divider />;
    case 'permission_request':
      return <PermissionRequestCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'permission_decision':
      return <PermissionDecisionCard item={item} sessionId={sessionId} agentId={agentId} />;
  }
}

function itemEqual(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a === b) {
    return true;
  }
  if (a.kind !== b.kind || a.key !== b.key) {
    return false;
  }
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

type FileEditBlockProps = {
  path: string;
  editType: 'create' | 'modify' | 'delete';
  workingDir?: string | null;
  onOpenDiff?: (filePath: string) => void;
};

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
  if (n < 1000) {
    return String(n);
  }
  if (n < 10_000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return `${Math.round(n / 1000)}k`;
}

function UsageStat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="tabular-nums text-foreground/70">{value}</span>
      <span className="text-2xs uppercase tracking-wide text-muted-foreground/50">{label}</span>
    </span>
  );
}

function UsageRow({ usage }: { usage: Extract<TranscriptItem, { kind: 'usage' }>['usage'] }) {
  return (
    <div className="flex w-fit flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-subtle/40 px-2 py-1 text-xs text-muted-foreground">
      <UsageStat value={formatTokens(usage.inputTokens)} label="in" />
      <span aria-hidden className="text-muted-foreground/30">
        ·
      </span>
      <UsageStat value={formatTokens(usage.outputTokens)} label="out" />
      {usage.cachedInputTokens > 0 ? (
        <>
          <span aria-hidden className="text-muted-foreground/30">
            ·
          </span>
          <UsageStat value={formatTokens(usage.cachedInputTokens)} label="cached" />
        </>
      ) : null}
      {usage.estimatedCostUsd > 0 ? (
        <>
          <span aria-hidden className="text-muted-foreground/30">
            ·
          </span>
          <span className="tabular-nums text-foreground/70">
            ~{formatUsd(usage.estimatedCostUsd)}
          </span>
        </>
      ) : null}
    </div>
  );
}

function AssistantText({ text, sessionId }: { text: string; sessionId: SessionId | null }) {
  const displayText = stripControlMarkers(text);
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
      {displayText.length > 0 ? <Markdown text={displayText} /> : null}
      {sessionId ? (
        <div className="flex flex-col items-start gap-2 empty:hidden [&:not(:empty)]:mt-2">
          <PlanChip assistantText={text} sessionId={sessionId} />
          <ClustersCard assistantText={text} sessionId={sessionId} />
          <HandoffChip assistantText={text} sessionId={sessionId} />
          <CommentResolvedChip assistantText={text} sessionId={sessionId} />
          <CommentWontfixChip assistantText={text} sessionId={sessionId} />
        </div>
      ) : null}
    </div>
  );
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
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
      return;
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

function AttachmentThumb({
  attachment,
  workingDir,
}: {
  attachment: MessageAttachment;
  workingDir: string | null;
}) {
  if (attachment.kind === 'file') {
    return <AttachmentFileCard attachment={attachment} workingDir={workingDir} />;
  }
  return <AttachmentImage attachment={attachment} workingDir={workingDir} />;
}

function AttachmentImage({
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
        if (alive) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
        }
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
    return <Skeleton className="h-28 w-28 rounded-lg" />;
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

function AttachmentFileCard({
  attachment,
  workingDir,
}: {
  attachment: MessageAttachment;
  workingDir: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const Icon = fileIconFor(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';

  const openPreview = () => {
    if (!isPdf || !workingDir) {
      return;
    }
    if (src !== null) {
      setPreviewOpen(true);
      return;
    }
    setLoading(true);
    readAttachment(workingDir, attachment.relPath)
      .then((dataUrl) => {
        setSrc(dataUrl);
        setPreviewOpen(true);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        type="button"
        disabled={!isPdf}
        onClick={openPreview}
        title={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        aria-label={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        className="flex max-w-[16rem] items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2 ring-1 ring-border-soft transition-colors enabled:cursor-zoom-in enabled:hover:bg-foreground/10"
      >
        <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-foreground/80">{attachment.fileName}</span>
        {loading ? (
          <span className="shrink-0 text-2xs text-muted-foreground">loading...</span>
        ) : null}
      </button>
      {previewOpen && src !== null ? (
        <ImageLightbox
          media="pdf"
          src={src}
          alt={attachment.fileName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function UserText({
  text,
  at,
  attachments,
  provider,
  model,
  workingDir = null,
}: {
  text: string;
  at: string;
  attachments?: ReadonlyArray<MessageAttachment>;
  provider?: ProviderId;
  model?: string;
  workingDir?: string | null;
}) {
  const atts = attachments ?? [];
  return (
    <div className="ml-auto flex w-fit max-w-[85%] flex-col gap-1.5 rounded-md border border-info/30 bg-info/10 px-4 pb-1.5 pt-2.5">
      {atts.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {atts.map((a) => (
            <AttachmentThumb key={a.id} attachment={a} workingDir={workingDir} />
          ))}
        </div>
      )}
      {text.length > 0 && (
        <div className="text-sm text-foreground">
          <Markdown text={text} />
        </div>
      )}
      <div className="flex items-center justify-end gap-1.5 text-2xs text-foreground/55">
        {provider ? <ProviderFootnote provider={provider} model={model} /> : null}
        <span className="font-mono">{formatHHMM(at)}</span>
        {text.length > 0 && <InlineCopyButton value={text} />}
      </div>
    </div>
  );
}

function ProviderFootnote({ provider, model }: { provider: ProviderId; model?: string }) {
  const Icon = PROVIDER_BRAND[provider].icon;
  const label = PROVIDER_LABEL[provider];
  return (
    <span
      className="mr-auto inline-flex items-center gap-1 text-foreground/45"
      title={`sent to ${label}${model ? ` · ${modelLabel(model)}` : ''}`}
    >
      <Icon size={11} aria-hidden style={{ color: brandColor(provider) }} />
      <span>{label}</span>
      {model ? <span className="text-foreground/35">· {modelLabel(model)}</span> : null}
    </span>
  );
}
