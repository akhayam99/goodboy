import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, RoleModelPreferences } from '@goodboy/types';
import { Button, Checkbox, EmptyState } from '@goodboy/ui';
import { ChevronDown, Sliders } from 'lucide-react';
import { RoutingBadge } from '../../../../../shared/components/RoutingBadge';
import type { ResolveModelChoice } from '../../../../chat/spawn-from-comment';
import type { CommentThread } from '../../../comment-threads';
import type { ResolverLink } from '../../../../session/resolver-linkage';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { aggregateConfig, defaultConfig, type CardConfig } from './config';
import { isClaimedLink } from './isClaimedLink';
import { ResolveCard } from './ResolveCard';
import { ResolveConfigPopover } from './ResolveConfigPopover';

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
    choice: ResolveModelChoice,
  ) => void;
  readonly onOpenResolver?: (agentId: AgentId) => void;
  readonly onOpenThread: (threadId: string) => void;
  readonly roleModels: RoleModelPreferences | null;
};

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
  const [defaultsOverride, setDefaultsOverride] = useState<CardConfig | null>(null);
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());

  const base = useMemo(() => defaultConfig({ roleModels }), [roleModels]);
  const defaults = defaultsOverride ?? base;
  const getConfig = (id: string): CardConfig => configById[id] ?? defaults;
  const patchConfig = (id: string, next: CardConfig) =>
    setConfigById((prev) => ({ ...prev, [id]: next }));
  const applyToAll = () => setConfigById({});

  const selectable = useMemo(
    () => threads.filter((t) => !isClaimedLink({ link: resolverFor?.(t) })),
    [threads, resolverFor],
  );
  const selected = useMemo(
    () => selectable.filter((t) => !deselected.has(t.head.id)),
    [selectable, deselected],
  );
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const aggregate = aggregateConfig({
    configs: threads.map((t) => getConfig(t.head.id)),
    fallback: defaults,
  });

  if (threads.length === 0) {
    return (
      <EmptyState
        bordered
        tone={CONCEPT_TONE.resolve}
        icon={CONCEPT_ICONS.resolve}
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
    threads.map((t) => [t.head.id, { ...getConfig(t.head.id) }]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-md bg-background/95 px-2.5 py-2 backdrop-blur">
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && selected.length > 0}
          onChange={toggleAll}
          label={<span className="font-medium">{selected.length} selected</span>}
        />

        <div>
          <ResolveConfigPopover
            ariaLabel="Configure batch resolvers"
            config={defaults}
            connectedProviders={connectedProviders}
            primaryLabel="Apply to all cards"
            onChange={setDefaultsOverride}
            onPrimary={applyToAll}
            renderTrigger={(open, popoverToggle) => (
              <Button
                variant="secondary"
                emphasis="outline"
                size="sm"
                onClick={popoverToggle}
                aria-expanded={open}
                title="Apply one resolver configuration to every comment"
                className="bg-subtle px-2"
              >
                <Sliders size={12} aria-hidden className="text-muted-foreground" />
                <span className="text-muted-foreground">Resolve all with</span>
                {aggregate === 'mixed' ? (
                  <span className="font-medium text-foreground">Customized</span>
                ) : (
                  <RoutingBadge provider={aggregate.provider} model={aggregate.model} />
                )}
                <ChevronDown size={11} aria-hidden className="text-muted-foreground" />
              </Button>
            )}
          />
        </div>

        {selected.length >= 2 ? (
          <Button
            variant="accent"
            emphasis="outline"
            size="sm"
            onClick={() => onSpawnCombined(selected, { ...defaults })}
            disabled={selected.length > 8}
            title={selected.length > 8 ? 'Too many threads for one resolver (max 8)' : undefined}
            className="font-semibold"
          >
            <CONCEPT_ICONS.resolve size={12} aria-hidden />
            Spawn 1 combined resolver
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => onSpawnBatch(selected, choiceById)}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CONCEPT_ICONS.resolve size={12} aria-hidden />
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
              checked={!deselected.has(t.head.id)}
              link={resolverFor?.(t)}
              connectedProviders={connectedProviders}
              onToggle={() => toggle(t.head.id)}
              onConfig={(next) => patchConfig(t.head.id, next)}
              onResolve={() => onSpawnOne(t, { ...getConfig(t.head.id) })}
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
