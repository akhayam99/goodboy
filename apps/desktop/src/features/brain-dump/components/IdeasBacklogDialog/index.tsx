import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog } from '@goodboy/ui';
import { AlertTriangle, Inbox, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { IdeaBacklog, IdeaBacklogId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ClusterReviewDialog } from '../ClusterReviewDialog';

interface IdeasBacklogDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly workspaceId: WorkspaceId;
}

export function IdeasBacklogDialog({ open, onClose, workspaceId }: IdeasBacklogDialogProps) {
  const ideas = useAppStore((s) => s.ideas[workspaceId] ?? null);
  const loading = useAppStore((s) => s.ideasLoading[workspaceId] ?? false);
  const rephrasingIds = useAppStore((s) => s.rephrasingIdeaIds);
  const clusterizing = useAppStore((s) => s.clusterizing);
  const clusterPreview = useAppStore((s) => s.clusterPreview);
  const clusterError = useAppStore((s) => s.clusterError);
  const workspaces = useAppStore((s) => s.workspaces);
  const loadIdeasForWorkspace = useAppStore((s) => s.loadIdeasForWorkspace);
  const deleteIdea = useAppStore((s) => s.deleteIdea);
  const retryRephrase = useAppStore((s) => s.retryRephrase);
  const runClusterer = useAppStore((s) => s.runClusterer);
  const dismissClusterPreview = useAppStore((s) => s.dismissClusterPreview);
  const [clusterReviewOpen, setClusterReviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadIdeasForWorkspace(workspaceId);
  }, [open, workspaceId, loadIdeasForWorkspace]);

  // Open the cluster review dialog whenever a preview becomes available.
  useEffect(() => {
    if (clusterPreview && clusterPreview.clusters.length > 0) {
      setClusterReviewOpen(true);
    }
  }, [clusterPreview]);

  const onCluster = useCallback(async () => {
    await runClusterer(workspaceId);
  }, [runClusterer, workspaceId]);

  const onCloseAll = () => {
    setClusterReviewOpen(false);
    dismissClusterPreview();
    onClose();
  };

  const rephrasedCount = (ideas ?? []).filter((i) => i.status === 'rephrased').length;
  const canCluster = rephrasedCount >= 2 && !clusterizing;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        fixedHeightClass="h-[640px]"
        title={
          <span className="inline-flex items-center gap-2">
            <Inbox size={14} aria-hidden />
            ideas backlog
            <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">
              {(ideas ?? []).length} items
            </span>
          </span>
        }
        description="raw thoughts captured from the brain dump, rephrased into actionable cards"
        footer={
          <div className="flex w-full items-center gap-2 text-xs">
            <Button
              variant="primary"
              onClick={() => void onCluster()}
              disabled={!canCluster}
              title={
                canCluster
                  ? 'group similar ideas into proposed clusters'
                  : 'need at least 2 rephrased ideas to cluster'
              }
            >
              {clusterizing ? (
                <Loader2 size={13} aria-hidden className="mr-1.5 animate-spin" />
              ) : (
                <Sparkles size={13} aria-hidden className="mr-1.5" />
              )}
              cluster ({rephrasedCount})
            </Button>
            {clusterError ? (
              <span className="text-2xs text-danger">{clusterError}</span>
            ) : (
              <div className="flex-1" />
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {loading && (ideas ?? null) === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" aria-hidden /> loading…
            </div>
          ) : (ideas ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {(ideas ?? []).map((idea) => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  rephrasing={rephrasingIds.has(idea.id)}
                  suggestedWorkspaceName={
                    idea.suggestedWorkspaceId && idea.suggestedWorkspaceId !== workspaceId
                      ? (workspaces.find((w) => w.id === idea.suggestedWorkspaceId)?.name ?? null)
                      : null
                  }
                  onDelete={() => void deleteIdea(idea.id)}
                  onRetry={() => void retryRephrase(idea.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </Dialog>
      <ClusterReviewDialog
        open={clusterReviewOpen}
        onClose={onCloseAll}
        workspaceId={workspaceId}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
      <Inbox size={20} aria-hidden className="text-muted-foreground/60" />
      <p>no ideas yet.</p>
      <p>drop one with the brain dump icon (pencil) in the sidebar footer.</p>
    </div>
  );
}

interface IdeaRowProps {
  readonly idea: IdeaBacklog;
  readonly rephrasing: boolean;
  readonly suggestedWorkspaceName: string | null;
  readonly onDelete: () => void;
  readonly onRetry: () => void;
}

function IdeaRow({ idea, rephrasing, suggestedWorkspaceName, onDelete, onRetry }: IdeaRowProps) {
  const title = idea.rephrasedTitle ?? idea.rawText;
  const body = idea.rephrasedBody;
  return (
    <li className="group flex flex-col gap-1 rounded-md border border-border bg-muted/10 px-3 py-2 hover:border-border/60">
      <div className="flex items-center gap-2">
        {rephrasing ? (
          <Loader2 size={11} aria-hidden className="animate-spin text-muted-foreground" />
        ) : null}
        <span
          className={
            rephrasing && !idea.rephrasedTitle
              ? 'text-xs italic text-muted-foreground'
              : 'text-xs font-medium text-foreground'
          }
        >
          {rephrasing && !idea.rephrasedTitle ? `rephrasing: ${title}` : title}
        </span>
        <StatusChip status={idea.status} />
        {suggestedWorkspaceName ? (
          <span
            className="rounded-full border border-border bg-background px-1.5 py-0.5 text-2xs text-muted-foreground"
            title="rephraser suggested this workspace"
          >
            → {suggestedWorkspaceName}
          </span>
        ) : null}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {idea.status === 'failed' ? (
            <button
              type="button"
              onClick={onRetry}
              title="retry rephrasing"
              aria-label="retry"
              className="rounded p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            >
              <RefreshCw size={11} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            title="delete idea"
            aria-label="delete idea"
            className="rounded p-1 text-muted-foreground/70 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={11} aria-hidden />
          </button>
        </div>
      </div>
      {body ? <p className="line-clamp-2 text-2xs text-muted-foreground">{body}</p> : null}
      {idea.status === 'failed' && idea.lastError ? (
        <p className="inline-flex items-center gap-1 text-2xs text-danger">
          <AlertTriangle size={10} aria-hidden /> {idea.lastError}
        </p>
      ) : null}
    </li>
  );
}

function StatusChip({ status }: { status: IdeaBacklog['status'] }) {
  if (status === 'rephrased') {
    return (
      <span className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-2xs font-medium text-success">
        ready
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="rounded-full border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-2xs font-medium text-danger">
        failed
      </span>
    );
  }
  if (status === 'spawned') {
    return (
      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
        spawned
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
      raw
    </span>
  );
}

// Stub re-export so the import path doesn't break before commit 14 lands.
export type { IdeaBacklogId };
