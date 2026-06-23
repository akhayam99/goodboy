import { Fragment, useState } from 'react';
import { MessageSquareReply } from 'lucide-react';
import type { AgentId } from '@goodboy/types';
import { Chip, Collapsible, Eyebrow, ScrollFade, StatusDot, cn } from '@goodboy/ui';
import { AGENT_KIND_PALETTE, type AgentKind } from '../../../session/agent-kind';
import {
  kindEyebrow,
  outcomeTone,
  outcomeWord,
  resolverOutcome,
  type SpawnNode,
  type SpawnNodeStatus,
} from './lib';

type SpawnTreeVariant = 'inline' | 'dashboard' | 'rail';

type SpawnTreeProps = {
  readonly nodes: ReadonlyArray<SpawnNode>;
  readonly variant?: SpawnTreeVariant;
  readonly depth?: number;
  readonly onSelect: (id: AgentId) => void;
  readonly onJumpToComment?: (url: string) => void;
};

const DEPTH_CAP = 4;

const DESTRUCTIVE_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>(['debugger', 'generic']);

const isDoneStatus = (status: SpawnNodeStatus): boolean =>
  status === 'done' || status === 'planned';

type SpawnNodeRowProps = {
  readonly node: SpawnNode;
  readonly variant: SpawnTreeVariant;
  readonly onSelect: (id: AgentId) => void;
  readonly onJumpToComment?: (url: string) => void;
};

const SpawnNodeRow = ({ node, variant, onSelect, onJumpToComment }: SpawnNodeRowProps) => {
  const [open, setOpen] = useState(false);
  const palette = AGENT_KIND_PALETTE[node.kind];
  const running = node.status === 'running';
  const dense = variant === 'inline';
  const rowClass = cn(
    'group relative flex w-full items-center gap-2 rounded-lg border border-transparent text-left motion-safe:transition-colors',
    dense ? 'px-2 py-1' : 'px-2.5 py-1.5',
    running && (DESTRUCTIVE_KINDS.has(node.kind) ? 'border-danger/50' : 'border-info/50'),
    node.isSelected
      ? 'bg-elevated text-foreground'
      : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
  );

  const planned = node.status === 'planned';
  const leading = running ? (
    <StatusDot tone={DESTRUCTIVE_KINDS.has(node.kind) ? 'danger' : 'info'} size="sm" pulsing />
  ) : (
    <span
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        palette.bg,
        planned && 'opacity-60',
      )}
      aria-hidden
    />
  );

  const trailing = node.resolver ? (
    <span className="flex shrink-0 items-center gap-1">
      <Chip {...resolverOutcome(node.resolver.state)} size="sm" />
      {node.resolver.commentUrl != null && onJumpToComment != null ? (
        <button
          type="button"
          onClick={() => onJumpToComment(node.resolver?.commentUrl ?? '')}
          title="go to the review comment"
          aria-label="go to the review comment"
          className="rounded-md p-0.5 text-muted-foreground/60 motion-safe:transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <MessageSquareReply size={11} aria-hidden />
        </button>
      ) : null}
    </span>
  ) : (
    <>
      <span className="shrink-0 text-2xs text-muted-foreground/70">
        {planned ? 'planned' : outcomeWord(node.status)}
      </span>
      {node.costUsd > 0 ? (
        <span
          className="shrink-0 tabular-nums text-2xs text-muted-foreground/60"
          title={`$${node.costUsd.toFixed(4)}`}
        >
          ${node.costUsd.toFixed(2)}
        </span>
      ) : null}
    </>
  );

  const rowInner = (
    <>
      <span className="flex size-3.5 shrink-0 items-center justify-center">{leading}</span>
      <span className={cn('min-w-0 flex-1 truncate font-medium', dense ? 'text-xs' : 'text-sm')}>
        {node.name}
      </span>
      {trailing}
    </>
  );

  const row = planned ? (
    <div className={cn(rowClass, 'cursor-default')}>{rowInner}</div>
  ) : (
    <button type="button" onClick={() => onSelect(node.id)} className={rowClass}>
      {rowInner}
    </button>
  );

  if (variant === 'dashboard' && node.outputSummary) {
    return (
      <div className="flex flex-col">
        {row}
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          className="pl-5 text-xs"
          trigger={<span className="text-2xs text-muted-foreground/70">summary</span>}
        >
          <ScrollFade fadeFrom="background" viewportClassName="max-h-32">
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
              {node.outputSummary}
            </p>
          </ScrollFade>
        </Collapsible>
      </div>
    );
  }

  return row;
};

type GroupHeaderProps = {
  readonly kind: AgentKind;
  readonly nodes: ReadonlyArray<SpawnNode>;
};

const GroupHeader = ({ kind, nodes }: GroupHeaderProps) => {
  const done = nodes.filter((n) => isDoneStatus(n.status)).length;
  const { label } = kindEyebrow(kind, done, nodes.length);
  return <Eyebrow label={label} className={AGENT_KIND_PALETTE[kind].fg} />;
};

const RailRow = ({
  node,
  onSelect,
}: {
  readonly node: SpawnNode;
  readonly onSelect: (id: AgentId) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(node.id)}
    title={`${node.name}: ${outcomeWord(node.status) || 'planned'}`}
    aria-label={`${node.name}: ${outcomeWord(node.status) || 'planned'}`}
    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-soft bg-subtle px-2 py-0.5 text-2xs font-medium text-foreground/80 motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
  >
    {node.status === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing />
    ) : (
      <StatusDot
        tone={outcomeTone(node.status)}
        size="sm"
        className={node.status === 'planned' ? 'opacity-60' : undefined}
      />
    )}
    <span className="max-w-[10rem] truncate">{node.name}</span>
  </button>
);

export const SpawnTree = ({
  nodes,
  variant = 'inline',
  depth = 0,
  onSelect,
  onJumpToComment,
}: SpawnTreeProps) => {
  if (nodes.length === 0 || depth > DEPTH_CAP) {
    return null;
  }

  if (variant === 'rail') {
    return (
      <ScrollFade orientation="horizontal" fadeFrom="background" viewportClassName="flex gap-1">
        {nodes.map((node) => (
          <RailRow key={node.id} node={node} onSelect={onSelect} />
        ))}
      </ScrollFade>
    );
  }

  const head = nodes[0];
  const headKind = head?.kind;
  const showGroupHeader =
    depth > 0 && nodes.length > 1 && headKind != null && nodes.every((n) => n.kind === headKind);

  return (
    <div className={cn('flex flex-col', variant === 'dashboard' ? 'gap-3' : 'gap-1')}>
      {showGroupHeader && head ? <GroupHeader kind={head.kind} nodes={nodes} /> : null}
      {nodes.map((node) => (
        <Fragment key={node.id}>
          <SpawnNodeRow
            node={node}
            variant={variant}
            onSelect={onSelect}
            onJumpToComment={onJumpToComment}
          />
          {node.children.length > 0 ? (
            <div className="ml-3 border-l border-border-soft pl-2">
              <SpawnTree
                nodes={node.children}
                variant={variant}
                depth={depth + 1}
                onSelect={onSelect}
                onJumpToComment={onJumpToComment}
              />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
};
