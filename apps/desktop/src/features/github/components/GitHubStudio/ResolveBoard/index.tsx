import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PrComment, ProviderId } from '@goodboy/types';
import { cn, EmptyState } from '@goodboy/ui';
import { ChevronDown, ExternalLink, Sliders, Sparkles } from 'lucide-react';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelEffortLevels,
  type EffortLevel,
} from '../../../../chat/utils/chat-constants';
import { shortModelWithVersion } from '../../../../session/agent-row-format';
import { ProviderSelect } from '../../../../session/components/ProviderSelect';
import { ModelSelect } from '../../../../session/components/ModelSelect';
import { EffortSelect } from '../../../../session/components/EffortSelect';
import type { ResolveModelChoice } from '../../../../chat/spawn-from-comment';
import { useAppStore } from '../../../../../store';
import { DEFAULT_CONFIG, aggregateConfig, clampEffort, configFor, type CardConfig } from './config';

interface Props {
  readonly comments: ReadonlyArray<PrComment>;
  readonly onSpawnOne: (comment: PrComment, choice: ResolveModelChoice) => void;
  readonly onSpawnBatch: (
    comments: ReadonlyArray<PrComment>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => void;
  readonly onOpenThread: (threadId: string) => void;
}

export function ResolveBoard({ comments, onSpawnOne, onSpawnBatch, onOpenThread }: Props) {
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const [configById, setConfigById] = useState<Readonly<Record<string, CardConfig>>>({});
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const [overrideOpen, setOverrideOpen] = useState(false);

  const getConfig = (id: string): CardConfig => configById[id] ?? DEFAULT_CONFIG;
  const patchConfig = (id: string, next: CardConfig) =>
    setConfigById((prev) => ({ ...prev, [id]: next }));
  const applyToAll = (next: CardConfig) =>
    setConfigById(() => Object.fromEntries(comments.map((c) => [c.id, next])));

  const selected = useMemo(
    () => comments.filter((c) => !deselected.has(c.id)),
    [comments, deselected],
  );
  const allSelected = selected.length === comments.length;
  const aggregate = aggregateConfig(comments.map((c) => getConfig(c.id)));

  if (comments.length === 0) {
    return (
      <EmptyState
        bordered
        icon={Sparkles}
        title="Nothing to resolve"
        description="Open review comments will appear here."
      />
    );
  }

  const toggle = (id: string) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setDeselected(allSelected ? new Set(comments.map((c) => c.id)) : new Set());

  const choiceById: Record<string, ResolveModelChoice> = Object.fromEntries(
    comments.map((c) => [c.id, getConfig(c.id)]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-background/95 px-2.5 py-2 backdrop-blur">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && selected.length > 0;
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
            title="apply one provider/model/effort to every comment"
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
              config={aggregate === 'mixed' ? DEFAULT_CONFIG : aggregate}
              connectedProviders={connectedProviders}
              onChange={(next) => applyToAll(next)}
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

        <button
          type="button"
          onClick={() => onSpawnBatch(selected, choiceById)}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={12} aria-hidden />
          Spawn resolver for {selected.length} {selected.length === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {comments.map((c) => (
          <li key={c.id}>
            <ResolveCard
              comment={c}
              config={getConfig(c.id)}
              checked={!deselected.has(c.id)}
              connectedProviders={connectedProviders}
              onToggle={() => toggle(c.id)}
              onConfig={(next) => patchConfig(c.id, next)}
              onResolve={() => onSpawnOne(c, getConfig(c.id))}
              onOpenThread={c.threadId ? () => onOpenThread(c.threadId as string) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResolveCard({
  comment,
  config,
  checked,
  connectedProviders,
  onToggle,
  onConfig,
  onResolve,
  onOpenThread,
}: {
  comment: PrComment;
  config: CardConfig;
  checked: boolean;
  connectedProviders: ReadonlyArray<ProviderId>;
  onToggle: () => void;
  onConfig: (next: CardConfig) => void;
  onResolve: () => void;
  onOpenThread?: () => void;
}) {
  const [configOpen, setConfigOpen] = useState(false);
  const loc = comment.path
    ? `${comment.path}${comment.line ? `:${comment.line}` : ''}`
    : 'conversation';
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        checked ? 'border-border bg-muted/10' : 'border-border-soft/60 bg-muted/5 opacity-70',
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`include comment by ${comment.author}`}
          className="mt-0.5 size-3.5 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{comment.author}</span>
            <span className="opacity-50">·</span>
            <span className="min-w-0 truncate font-mono text-[11px]">{loc}</span>
            {onOpenThread ? (
              <button
                type="button"
                onClick={onOpenThread}
                title="open the full thread"
                aria-label="open the full thread"
                className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink size={12} aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-snug text-foreground [overflow-wrap:anywhere]">
            {comment.body.trim() || '(empty)'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                  <span className="text-muted-foreground/70">· {EFFORT_LABEL[config.effort]}</span>
                ) : null}
                <ChevronDown size={11} aria-hidden className="text-muted-foreground" />
              </button>
              {configOpen ? (
                <ConfigPanel
                  className="absolute left-0 top-8 z-20 w-60"
                  title="Resolve with"
                  config={config}
                  connectedProviders={connectedProviders}
                  onChange={onConfig}
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
              title="spawn a resolver for this comment now"
              className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-2xs font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              <Sparkles size={11} aria-hidden />
              Resolve
            </button>
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
  connectedProviders,
  onChange,
  footer,
}: {
  className?: string;
  title: string;
  config: CardConfig;
  connectedProviders: ReadonlyArray<ProviderId>;
  onChange: (next: CardConfig) => void;
  footer?: ReactNode;
}) {
  const onProvider = (next: ProviderId | '') => {
    if (next === '') return;
    onChange(configFor(next));
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
      <ProviderSelect
        value={config.provider}
        providers={connectedProviders}
        onChange={onProvider}
        disabled={connectedProviders.length === 0}
      />
      <ModelSelect
        provider={config.provider}
        value={config.model}
        onChange={onModel}
        disabled={false}
      />
      <EffortSelect
        model={config.model}
        value={config.effort}
        onChange={onEffort}
        disabled={false}
      />
      {footer}
    </div>
  );
}
