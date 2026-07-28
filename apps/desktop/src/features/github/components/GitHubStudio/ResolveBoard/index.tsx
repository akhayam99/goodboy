import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { cn, EmptyState, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import {
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelEffortLevels,
  type EffortLevel,
} from '../../../../chat/utils/chat-constants';
import { shortModelWithVersion } from '../../../../session/agent-row-format';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import type { ResolveMode, ResolveModelChoice } from '../../../../chat/spawn-from-comment';
import type { CommentThread } from '../../../comment-threads';
import {
  ResolverStateBadge,
  resolverBadgeState,
} from '../../../../session/components/ResolverStateBadge';
import type { ResolverLink } from '../../../../session/resolver-linkage';
import { useAppStore } from '../../../../../store';
import { aggregateConfig, clampEffort, configFor, defaultConfig, type CardConfig } from './config';

type Props = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly resolverFor?: (thread: CommentThread) => ResolverLink | undefined;
  readonly onSpawnOne: (thread: CommentThread, choice: ResolveModelChoice) => void;
  readonly onSpawnBatch: (
    threads: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => void;
  readonly onSpawnCombined: (
    threads: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => void;
  readonly onOpenResolver?: (agentId: AgentId) => void;
  readonly onOpenThread: (threadId: string) => void;
  readonly roleModels: RoleModelPreferences | null;
};

const isClaimed = (link: ResolverLink | undefined): boolean =>
  link != null && link.status !== 'failed';

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<ResolveMode>> = [
  { label: 'Fix', value: 'fix' },
  { label: 'Analyze', value: 'analyze' },
];

export const ResolveBoard = ({
  threads,
  resolverFor,
  onSpawnOne,
  onSpawnBatch,
  onSpawnCombined,
  onOpenResolver,
  onOpenThread,
  roleModels,
}: Props) => {
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const [configById, setConfigById] = useState<Readonly<Record<string, CardConfig>>>({});
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [mode, setMode] = useState<ResolveMode>('fix');
  const [hint, setHint] = useState('');

  const base = useMemo(() => defaultConfig({ roleModels }), [roleModels]);
  const getConfig = (id: string): CardConfig => configById[id] ?? base;
  const patchConfig = (id: string, next: CardConfig) =>
    setConfigById((prev) => ({ ...prev, [id]: next }));
  const applyToAll = (next: CardConfig) =>
    setConfigById(() => Object.fromEntries(threads.map((t) => [t.head.id, next])));

  const selectable = useMemo(
    () => threads.filter((t) => !isClaimed(resolverFor?.(t))),
    [threads, resolverFor],
  );
  const selected = useMemo(
    () => selectable.filter((t) => !deselected.has(t.head.id)),
    [selectable, deselected],
  );
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const aggregate = aggregateConfig({
    configs: threads.map((t) => getConfig(t.head.id)),
    fallback: base,
  });

  if (threads.length === 0) {
    return (
      <EmptyState
        bordered
        tone="neutral"
        icon={Sparkles}
        title="Nothing to resolve"
        description="Open review comments will appear here."
      />
    );
  }

  const toggle = (id: string) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const toggleAll = () =>
    setDeselected(allSelected ? new Set(selectable.map((t) => t.head.id)) : new Set());

  const choiceById: Record<string, ResolveModelChoice> = Object.fromEntries(
    threads.map((t) => [t.head.id, { ...getConfig(t.head.id), mode, hint }]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-background/95 px-2.5 py-2 backdrop-blur">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) {
                el.indeterminate = !allSelected && selected.length > 0;
              }
            }}
            onChange={toggleAll}
            className="size-3.5 accent-primary"
          />
          <span className="font-medium">{selected.length} selected</span>
        </label>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setOverrideOpen((v) => !v)}
            title="apply one resolver configuration to every comment"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1 text-xs transition-colors hover:bg-muted/50"
          >
            <Sliders size={12} aria-hidden className="text-muted-foreground" />
            <span className="text-muted-foreground">Resolve all with</span>
            <span className="font-medium text-foreground">
              {aggregate === 'mixed' ? 'Customized' : shortModelWithVersion(aggregate.model)}
            </span>
            <ChevronDown size={11} aria-hidden className="text-muted-foreground" />
          </button>
          {overrideOpen ? (
            <ConfigPanel
              className="absolute right-0 top-8 z-20 w-64"
              title="Apply to all comments"
              config={aggregate === 'mixed' ? base : aggregate}
              base={base}
              mode={mode}
              hint={hint}
              connectedProviders={connectedProviders}
              onChange={(next) => applyToAll(next)}
              onMode={setMode}
              onHint={setHint}
              footer={
                <button
                  type="button"
                  onClick={() => setOverrideOpen(false)}
                  className="w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              }
            />
          ) : null}
        </div>

        {selected.length >= 2 ? (
          <button
            type="button"
            onClick={() => onSpawnCombined(selected, choiceById)}
            disabled={selected.length > 8}
            title={selected.length > 8 ? 'Too many threads for one resolver (max 8)' : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-2.5 py-1 text-xs font-semibold text-accent transition-opacity hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={12} aria-hidden />
            Spawn 1 combined resolver
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSpawnBatch(selected, choiceById)}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={12} aria-hidden />
          {selected.length >= 2
            ? `Spawn ${selected.length} resolvers`
            : `Spawn resolver for ${selected.length} comment`}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {threads.map((t) => (
          <li key={t.head.id}>
            <ResolveCard
              thread={t}
              config={getConfig(t.head.id)}
              base={base}
              checked={!deselected.has(t.head.id)}
              link={resolverFor?.(t)}
              connectedProviders={connectedProviders}
              onToggle={() => toggle(t.head.id)}
              onConfig={(next) => patchConfig(t.head.id, next)}
              onResolve={() => onSpawnOne(t, { ...getConfig(t.head.id), mode, hint })}
              mode={mode}
              hint={hint}
              onMode={setMode}
              onHint={setHint}
              onOpenResolver={onOpenResolver}
              onOpenThread={
                t.head.threadId ? () => onOpenThread(t.head.threadId as string) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

function ResolveCard({
  thread,
  config,
  base,
  checked,
  link,
  connectedProviders,
  onToggle,
  onConfig,
  onResolve,
  mode,
  hint,
  onMode,
  onHint,
  onOpenResolver,
  onOpenThread,
}: {
  thread: CommentThread;
  config: CardConfig;
  base: CardConfig;
  checked: boolean;
  link?: ResolverLink;
  connectedProviders: ReadonlyArray<ProviderId>;
  onToggle: () => void;
  onConfig: (next: CardConfig) => void;
  onResolve: () => void;
  mode: ResolveMode;
  hint: string;
  onMode: (next: ResolveMode) => void;
  onHint: (next: string) => void;
  onOpenResolver?: (agentId: AgentId) => void;
  onOpenThread?: () => void;
}) {
  const [configOpen, setConfigOpen] = useState(false);
  const { head, replies } = thread;
  const loc = head.path ? `${head.path}${head.line ? `:${head.line}` : ''}` : 'conversation';
  const claimed = isClaimed(link);
  const failed = link != null && link.status === 'failed';
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        checked ? 'border-border bg-muted/10' : 'border-border-soft/60 bg-muted/5 opacity-70',
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked && !claimed}
          disabled={claimed}
          onChange={onToggle}
          aria-label={`include comment by ${head.author}`}
          className="mt-0.5 size-3.5 accent-primary disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{head.author}</span>
            <span className="opacity-50">·</span>
            <span className="min-w-0 truncate font-mono text-[11px]">{loc}</span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {link ? <ResolverStateBadge state={resolverBadgeState(link.status)} /> : null}
              {onOpenThread ? (
                <button
                  type="button"
                  onClick={onOpenThread}
                  title="open the full thread"
                  aria-label="open the full thread"
                  className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink size={12} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-snug text-foreground [overflow-wrap:anywhere]">
            {head.body.trim() || '(empty)'}
          </p>

          {replies.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-l border-border-soft pl-2.5">
              {replies.map((r) => (
                <div key={r.id} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">{r.author}</span>
                  <p className="line-clamp-2 whitespace-pre-wrap text-[12px] leading-snug text-muted-foreground/80 [overflow-wrap:anywhere]">
                    {r.body.trim() || '(empty)'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {claimed && link ? (
              <button
                type="button"
                onClick={() => onOpenResolver?.(link.agent.id as AgentId)}
                title="open the resolver working on this comment"
                className="inline-flex items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 text-2xs font-semibold text-info transition-colors hover:bg-info/20"
              >
                Open resolver
                <ArrowUpRight size={11} aria-hidden />
              </button>
            ) : (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setConfigOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1 text-2xs transition-colors hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">Resolve with</span>
                    <span className="font-medium text-foreground">
                      {PROVIDER_LABEL[config.provider]} · {shortModelWithVersion(config.model)}
                    </span>
                    {modelEffortLevels(config.model) ? (
                      <span className="text-muted-foreground/70">
                        · {EFFORT_LABEL[config.effort]}
                      </span>
                    ) : null}
                    <ChevronDown size={11} aria-hidden className="text-muted-foreground" />
                  </button>
                  {configOpen ? (
                    <ConfigPanel
                      className="absolute left-0 top-8 z-20 w-60"
                      title="Resolve with"
                      config={config}
                      base={base}
                      mode={mode}
                      hint={hint}
                      connectedProviders={connectedProviders}
                      onChange={onConfig}
                      onMode={onMode}
                      onHint={onHint}
                      footer={
                        <button
                          type="button"
                          onClick={() => setConfigOpen(false)}
                          className="w-full rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
                        >
                          Done
                        </button>
                      }
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onResolve}
                  title={
                    failed
                      ? 'retry the resolver for this comment'
                      : 'spawn a resolver for this comment now'
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition-colors',
                    failed
                      ? 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20'
                      : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
                  )}
                >
                  {failed ? (
                    <RotateCcw size={11} aria-hidden />
                  ) : (
                    <Sparkles size={11} aria-hidden />
                  )}
                  {failed ? 'Retry' : 'Resolve'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({
  className,
  title,
  config,
  base,
  mode,
  hint,
  connectedProviders,
  onChange,
  onMode,
  onHint,
  footer,
}: {
  className?: string;
  title: string;
  config: CardConfig;
  base: CardConfig;
  mode: ResolveMode;
  hint: string;
  connectedProviders: ReadonlyArray<ProviderId>;
  onChange: (next: CardConfig) => void;
  onMode: (next: ResolveMode) => void;
  onHint: (next: string) => void;
  footer?: ReactNode;
}) {
  const onProvider = (next: ProviderId | '') => {
    if (next === '') {
      return;
    }
    onChange(configFor({ provider: next, base }));
  };
  const onModel = (model: string) =>
    onChange({ ...config, model, effort: clampEffort(model, config.effort) });
  const onEffort = (effort: EffortLevel) => onChange({ ...config, effort });
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border-soft bg-background p-2 shadow-lg',
        className,
      )}
    >
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        {title}
      </span>
      <RoutingPicker
        ariaLabel={`${title} routing`}
        connectedProviders={connectedProviders}
        provider={config.provider}
        model={config.model}
        effort={{ editable: true, value: config.effort, onChange: onEffort }}
        disabled={false}
        onProvider={onProvider}
        onModel={onModel}
      />
      <SegmentedTabs
        ariaLabel="Resolver mode"
        value={mode}
        options={MODE_OPTIONS}
        onChange={onMode}
        size="sm"
        fill
      />
      <textarea
        aria-label="Resolver hint"
        value={hint}
        onChange={(event) => onHint(event.target.value)}
        rows={2}
        placeholder="Optional notes for the resolver: how to fix, what to avoid..."
        className="w-full resize-none rounded-md border border-border-soft bg-subtle px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
      />
      {footer}
    </div>
  );
}
