import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Input } from '@goodboy/ui';
import { Loader2, Sparkles } from 'lucide-react';
import type { IdeaCluster } from '@goodboy/core';
import type { IdeaBacklog, IdeaBacklogId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface ClusterReviewDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly workspaceId: WorkspaceId;
}

interface ClusterEdit {
  readonly name: string;
  readonly excludedIds: ReadonlySet<IdeaBacklogId>;
}

export function ClusterReviewDialog({ open, onClose, workspaceId }: ClusterReviewDialogProps) {
  const clusterPreview = useAppStore((s) => s.clusterPreview);
  const spawnFromCluster = useAppStore((s) => s.spawnFromCluster);
  const dismissClusterPreview = useAppStore((s) => s.dismissClusterPreview);
  const ideas = useAppStore((s) => s.ideas[workspaceId] ?? []);
  const [edits, setEdits] = useState<Record<string, ClusterEdit>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [spawningAll, setSpawningAll] = useState(false);
  const [spawnedIds, setSpawnedIds] = useState<ReadonlySet<string>>(new Set());

  // Reset local edit state when the preview shape changes.
  useEffect(() => {
    if (!clusterPreview) return;
    const init: Record<string, ClusterEdit> = {};
    for (const c of clusterPreview.clusters) {
      init[c.id] = { name: c.name, excludedIds: new Set<IdeaBacklogId>() };
    }
    setEdits(init);
    setSpawnedIds(new Set());
  }, [clusterPreview]);

  const ideaById = useMemo(() => {
    const m = new Map<IdeaBacklogId, IdeaBacklog>();
    for (const i of ideas) m.set(i.id, i);
    return m;
  }, [ideas]);

  const onSpawn = async (cluster: IdeaCluster) => {
    if (spawnedIds.has(cluster.id)) return;
    setBusyId(cluster.id);
    try {
      const edit = edits[cluster.id];
      const includedIds = cluster.itemIds.filter((id) => !edit?.excludedIds.has(id));
      if (includedIds.length === 0) return;
      const memberIdeas = includedIds
        .map((id) => ideaById.get(id))
        .filter((i): i is IdeaBacklog => Boolean(i));
      const bullets = memberIdeas
        .map((i) => {
          const t = i.rephrasedTitle ?? i.rawText.slice(0, 60);
          const b = i.rephrasedBody ?? '';
          return `- ${t}${b ? ` — ${b}` : ''}`;
        })
        .join('\n');
      const goal = [
        `Cluster: ${edit?.name ?? cluster.name}`,
        '',
        'Items to address:',
        bullets,
      ].join('\n');
      const filteredCluster: IdeaCluster = { ...cluster, itemIds: includedIds };
      await spawnFromCluster(filteredCluster, { workspaceId, sessionGoal: goal });
      setSpawnedIds((prev) => new Set([...prev, cluster.id]));
    } finally {
      setBusyId(null);
    }
  };

  const onSpawnAll = async () => {
    if (!clusterPreview || spawningAll) return;
    setSpawningAll(true);
    try {
      for (const cluster of clusterPreview.clusters) {
        if (spawnedIds.has(cluster.id)) continue;
        await onSpawn(cluster);
      }
    } finally {
      setSpawningAll(false);
    }
  };

  const onClose_ = () => {
    dismissClusterPreview();
    onClose();
  };

  const clusters = clusterPreview?.clusters ?? [];
  const allSpawned = clusters.length > 0 && clusters.every((c) => spawnedIds.has(c.id));

  return (
    <Dialog
      open={open}
      onClose={onClose_}
      size="lg"
      fixedHeightClass="h-[560px]"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles size={14} aria-hidden className="text-primary" />
          review clusters
          <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">
            {clusters.length} proposed
          </span>
        </span>
      }
      description="rename a cluster, untick items you don't want, then spawn one session per cluster"
      footer={
        <div className="flex w-full items-center gap-2 text-xs">
          <Button
            variant="primary"
            onClick={() => void onSpawnAll()}
            disabled={spawningAll || allSpawned}
          >
            {spawningAll ? <Loader2 size={13} aria-hidden className="mr-1.5 animate-spin" /> : null}
            spawn all
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose_}>
            discard preview
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {clusters.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">no clusters proposed.</p>
        ) : (
          clusters.map((cluster) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              edit={edits[cluster.id] ?? { name: cluster.name, excludedIds: new Set() }}
              ideaById={ideaById}
              spawned={spawnedIds.has(cluster.id)}
              busy={busyId === cluster.id}
              onRename={(name) =>
                setEdits((prev) => ({
                  ...prev,
                  [cluster.id]: {
                    name,
                    excludedIds: prev[cluster.id]?.excludedIds ?? new Set(),
                  },
                }))
              }
              onToggleItem={(id) =>
                setEdits((prev) => {
                  const current = prev[cluster.id] ?? {
                    name: cluster.name,
                    excludedIds: new Set<IdeaBacklogId>(),
                  };
                  const next = new Set<IdeaBacklogId>(current.excludedIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return { ...prev, [cluster.id]: { ...current, excludedIds: next } };
                })
              }
              onSpawn={() => void onSpawn(cluster)}
            />
          ))
        )}
      </div>
    </Dialog>
  );
}

interface ClusterCardProps {
  readonly cluster: IdeaCluster;
  readonly edit: ClusterEdit;
  readonly ideaById: ReadonlyMap<IdeaBacklogId, IdeaBacklog>;
  readonly spawned: boolean;
  readonly busy: boolean;
  readonly onRename: (name: string) => void;
  readonly onToggleItem: (id: IdeaBacklogId) => void;
  readonly onSpawn: () => void;
}

function ClusterCard({
  cluster,
  edit,
  ideaById,
  spawned,
  busy,
  onRename,
  onToggleItem,
  onSpawn,
}: ClusterCardProps) {
  const remaining = cluster.itemIds.filter((id) => !edit.excludedIds.has(id)).length;
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 text-xs ${
        spawned
          ? 'border-success/40 bg-success/5 opacity-70'
          : 'border-border bg-muted/10 hover:border-border/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={12} aria-hidden className="text-primary" />
        <Input
          value={edit.name}
          onChange={(e) => onRename(e.target.value)}
          disabled={spawned || busy}
          aria-label="cluster name"
          className="h-7 flex-1 text-xs"
        />
        <span className="text-2xs text-muted-foreground">
          {remaining}/{cluster.itemIds.length} included
        </span>
        <button
          type="button"
          onClick={onSpawn}
          disabled={busy || spawned || remaining === 0}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={10} aria-hidden className="animate-spin" /> : null}
          {spawned ? 'spawned' : 'spawn session'}
        </button>
      </div>
      <ul className="flex flex-col gap-1 pl-1">
        {cluster.itemIds.map((id) => {
          const idea = ideaById.get(id);
          const excluded = edit.excludedIds.has(id);
          const label = idea?.rephrasedTitle ?? idea?.rawText.slice(0, 60) ?? id;
          return (
            <li key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!excluded}
                onChange={() => onToggleItem(id)}
                disabled={spawned || busy}
                aria-label={`include "${label}" in this cluster`}
                className="h-3 w-3"
              />
              <span
                className={excluded ? 'text-muted-foreground/50 line-through' : 'text-foreground'}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
