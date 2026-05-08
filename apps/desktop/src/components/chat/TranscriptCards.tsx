import { useState } from 'react';
import { Collapsible, CopyButton, cn } from '@kay-am/ui';
import type { TranscriptItem } from './transcript-items';
import { AuthRequiredCallout } from './AuthRequiredCallout';
import { SkillInvocationCard } from './SkillInvocationCard';
import { PhaseTransitionCard } from './PhaseTransitionCard';
import { PermissionRequestCard } from './PermissionRequestCard';
import { PermissionDecisionCard } from './PermissionDecisionCard';

const EDIT_TONE: Record<'create' | 'modify' | 'delete', string> = {
  create: 'bg-primary/10 text-primary',
  modify: 'bg-muted text-foreground',
  delete: 'bg-danger/10 text-danger',
};

interface TranscriptCardProps {
  readonly item: TranscriptItem;
  readonly onRefreshAuth?: () => void;
}

export function TranscriptCard({ item, onRefreshAuth }: TranscriptCardProps) {
  switch (item.kind) {
    case 'user_text':
      return <UserText text={item.text} />;
    case 'assistant_text':
      return <AssistantText text={item.text} />;
    case 'tool_call':
      return <ToolCall item={item} />;
    case 'file_edit':
      return (
        <div
          className={cn(
            'inline-flex w-fit items-center gap-2 rounded-md border border-border px-2 py-1 text-xs',
            EDIT_TONE[item.editType],
          )}
        >
          <span className="font-medium uppercase tracking-wide">{item.editType}</span>
          <code className="font-mono">{item.path}</code>
        </div>
      );
    case 'usage':
      return (
        <p className="text-xs text-muted-foreground">
          {item.usage.inputTokens} in / {item.usage.outputTokens} out tokens
          {item.usage.cachedInputTokens > 0 ? ` · ${item.usage.cachedInputTokens} cached` : ''}
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
    case 'phase_transition':
      return <PhaseTransitionCard item={item} />;
    case 'done':
      return <hr className="border-border" />;
    case 'permission_request':
      return <PermissionRequestCard item={item} />;
    case 'permission_decision':
      return <PermissionDecisionCard item={item} />;
  }
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="group relative rounded-lg border border-border bg-background px-3 py-2">
      <div className="absolute right-1 top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
        <CopyButton value={text} label="message" />
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
    </div>
  );
}

function UserText({ text }: { text: string }) {
  return (
    <div className="group relative ml-auto w-fit max-w-full rounded-lg bg-muted px-3 py-2">
      <div className="absolute right-1 top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
        <CopyButton value={text} label="message" />
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
    </div>
  );
}

function ToolCall({ item }: { item: Extract<TranscriptItem, { kind: 'tool_call' }> }) {
  const [open, setOpen] = useState(false);
  const tone = item.isError ? 'border-danger/40 bg-danger/5' : 'border-border bg-muted';
  return (
    <div className={cn('rounded-md border px-2 py-1.5', tone)}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        trigger={
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded bg-background px-1.5 py-0.5 font-mono text-2xs uppercase">
              tool
            </span>
            {item.toolName}
            {!item.ended ? (
              <span className="text-muted-foreground">…</span>
            ) : item.isError ? (
              <span className="text-danger">error</span>
            ) : null}
          </span>
        }
      >
        <pre className="overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
          input: {JSON.stringify(item.input, null, 2)}
        </pre>
        {item.ended ? (
          <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
            output: {JSON.stringify(item.output, null, 2)}
          </pre>
        ) : null}
      </Collapsible>
    </div>
  );
}
