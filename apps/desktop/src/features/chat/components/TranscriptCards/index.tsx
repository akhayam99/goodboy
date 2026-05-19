import { memo, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Copy, FileEdit, Wrench } from 'lucide-react';
import { CopyButton, Markdown, cn } from '@kay-am/ui';
import type { AgentId, SessionId } from '@kay-am/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { displayPath } from '../../utils/display-path';

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
      return <UserText text={item.text} at={item.at} />;
    case 'assistant_text':
      return <AssistantText text={item.text} />;
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
          {item.usage.estimatedCostUsd > 0
            ? ` · ~${formatCostUsd(item.usage.estimatedCostUsd)}`
            : ''}
        </p>
      );
    case 'error':
      return (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
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
      return <hr className="border-border" />;
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
        title="open in files modal"
        aria-label={`open ${rel} in files modal`}
        className="group inline-flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-md border border-info/20 bg-info/5 px-2 py-1 transition-colors hover:border-info/40 hover:bg-info/10"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="group inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-info/20 bg-info/5 px-2 py-1">
      {inner}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function formatCostUsd(cost: number): string {
  if (cost < 0.001) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="group relative text-[13px]">
      <div className="absolute -right-1 -top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
        <CopyButton value={text} label="message" />
      </div>
      <Markdown text={text} />
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

function UserText({ text, at }: { text: string; at: string }) {
  return (
    <div className="ml-auto flex w-fit max-w-[85%] flex-col gap-1 rounded-2xl bg-primary/15 px-4 pb-1.5 pt-2.5 ring-1 ring-primary/20">
      <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
      <div className="flex items-center justify-end gap-1.5 text-2xs text-foreground/55">
        <span className="font-mono">{formatHHMM(at)}</span>
        <InlineCopyButton value={text} />
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
          <pre className="min-w-0 whitespace-pre-wrap break-words rounded bg-subtle p-2 text-xs text-muted-foreground">
            input: {JSON.stringify(item.input, null, 2)}
          </pre>
          {item.ended ? (
            <pre className="min-w-0 whitespace-pre-wrap break-words rounded bg-subtle p-2 text-2xs text-muted-foreground">
              output: {JSON.stringify(item.output, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
