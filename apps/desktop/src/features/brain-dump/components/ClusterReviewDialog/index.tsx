import { useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import { Loader2, Sparkles } from 'lucide-react';
import type { IdeaCluster } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface ClusterReviewDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly workspaceId: WorkspaceId;
}

// Placeholder dialog wired into IdeasBacklogDialog. Real spawn UI lands in
// the next commit.
export function ClusterReviewDialog({ open, onClose, workspaceId }: ClusterReviewDialogProps) {
  const clusterPreview = useAppStore((s) => s.clusterPreview);
  const spawnFromCluster = useAppStore((s) => s.spawnFromCluster);
  const dismissClusterPreview = useAppStore((s) => s.dismissClusterPreview);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onSpawn = async (cluster: IdeaCluster) => {
    setBusyId(cluster.id);
    try {
      await spawnFromCluster(cluster, { workspaceId });
    } finally {
      setBusyId(null);
    }
  };

  const clusters = clusterPreview?.clusters ?? [];

  return (
    <Dialog
      open={open}
      onClose={() => {
        dismissClusterPreview();
        onClose();
      }}
      size="lg"
      title="review clusters"
      description="proposed groupings — spawn a session per cluster you want to act on"
      footer={
        <Button
          variant="ghost"
          onClick={() => {
            dismissClusterPreview();
            onClose();
          }}
        >
          discard preview
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        {clusters.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            no clusters proposed. add more ideas and try again.
          </p>
        ) : (
          clusters.map((cluster) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              busy={busyId === cluster.id}
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
  readonly busy: boolean;
  readonly onSpawn: () => void;
}

function ClusterCard({ cluster, busy, onSpawn }: ClusterCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/10 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Sparkles size={12} aria-hidden className="text-primary" />
        <span className="font-medium text-foreground">{cluster.name}</span>
        <span className="text-2xs text-muted-foreground">
          {cluster.itemIds.length} {cluster.itemIds.length === 1 ? 'idea' : 'ideas'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onSpawn}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={10} aria-hidden className="animate-spin" /> : null}
          spawn session
        </button>
      </div>
    </div>
  );
}
