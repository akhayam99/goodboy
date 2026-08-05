import { useEffect, useMemo } from 'react';
import {
  Button,
  Chip,
  Divider,
  EmptyState,
  Eyebrow,
  ScrollFade,
  SelectableRow,
  Skeleton,
} from '@goodboy/ui';
import type { ReviewablePr, ReviewablePrProvider, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { RefreshIconButton } from '../../../../shared/components/RefreshIconButton';
import { workspaceMountName } from '../../../../shared/utils/workspaceMountName';
import { PullRequestChip } from '../../../github/components/PullRequestChip';
import { NoteAvatar } from '../../../../shared/components/NoteAvatar';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { buildReviewInboxRows, type ReviewInboxScope } from './buildReviewInboxRows';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly provider: ReviewablePrProvider;
  readonly scope: ReviewInboxScope;
  readonly focusedPrId: string | null;
  readonly onSelect: (pr: ReviewablePr) => void;
};

export const ReviewInboxList = ({ workspaceId, provider, scope, focusedPrId, onSelect }: Props) => {
  const reviewPrs = useAppStore((s) => s.reviewPrs[workspaceId]);
  const refreshReviewPrs = useAppStore((s) => s.refreshReviewPrs);
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === workspaceId) ?? null,
  );
  const items = reviewPrs?.items;
  const isLoading = reviewPrs?.loading === true;
  const error = reviewPrs?.error ?? null;

  useEffect(() => {
    void refreshReviewPrs(workspaceId);
  }, [refreshReviewPrs, workspaceId]);

  const rows = useMemo(
    () => buildReviewInboxRows({ items: items ?? [], provider, scope }),
    [items, provider, scope],
  );

  const isInitialLoading = isLoading && (items == null || items.length === 0);
  const identifierPrefix = provider === 'gitlab' ? '!' : '#';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-1 pt-3">
        <Eyebrow label={scope === 'others' ? 'From teammates' : 'All open'} />
        <span className="text-2xs tabular-nums text-muted-foreground/50">{rows.length}</span>
        <Divider className="flex-1" />
        {rows.length > 0 ? (
          <RefreshIconButton
            label="Refresh pull requests"
            isLoading={isLoading}
            onClick={() => void refreshReviewPrs(workspaceId)}
            iconSize={12}
            className="size-6 border-transparent p-0"
          />
        ) : null}
      </div>
      {isInitialLoading ? (
        <div
          className="flex flex-col gap-1 px-3 pb-3"
          role="status"
          aria-label="Loading pull requests"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1.5 px-2 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-8 shrink-0 rounded" />
                <Skeleton className="h-3 flex-1 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-2.5 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error != null && rows.length === 0 ? (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
          <button
            type="button"
            onClick={() => void refreshReviewPrs(workspaceId)}
            className="self-start rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3">
          <EmptyState
            icon={CONCEPT_ICONS.review}
            tone={CONCEPT_TONE.review}
            title={
              scope === 'others' ? 'No open pull requests from teammates' : 'No open pull requests'
            }
            description={
              scope === 'others'
                ? 'Pull requests by other authors will show up here.'
                : 'Open pull requests on this repository will show up here.'
            }
            size="inline"
            action={
              <Button variant="ghost" size="sm" onClick={() => void refreshReviewPrs(workspaceId)}>
                Refresh
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <ul className="flex flex-col gap-0.5 px-3 pb-3 pt-1">
            {rows.map((pr) => {
              const isActive = pr.id === focusedPrId;
              const mountName = workspaceMountName({
                workspace,
                mountWorkspaceId: pr.mountWorkspaceId,
              });
              return (
                <li key={pr.id}>
                  <SelectableRow
                    selected={isActive}
                    onClick={() => onSelect(pr)}
                    title={pr.title}
                    ariaCurrent={isActive}
                    className="flex-col gap-1 px-2 py-1.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <PullRequestChip
                        state={pr.isDraft ? 'draft' : pr.state}
                        variant="icon"
                        iconSize={12}
                      />
                      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                        {identifierPrefix}
                        {pr.number}
                      </span>
                      {mountName != null ? <Chip tone="neutral" label={mountName} /> : null}
                      <span className="min-w-0 flex-1 truncate text-xs">{pr.title}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <NoteAvatar
                        url={pr.authorAvatarUrl}
                        alt=""
                        initialsSource={pr.author}
                        size="xs"
                      />
                      <span className="min-w-0 truncate text-2xs text-muted-foreground/70">
                        {pr.author}
                      </span>
                      <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
                        {formatRelativeDuration(pr.updatedAt)}
                      </span>
                      <span className="flex-1" />
                      {scope === 'all' && pr.mine ? (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground">
                          Mine
                        </span>
                      ) : null}
                      {pr.reviewRequested ? (
                        <span className="shrink-0 rounded-full bg-indigo-400/15 px-1.5 py-0.5 text-3xs font-semibold text-indigo-600 ring-1 ring-indigo-400/30">
                          Review requested
                        </span>
                      ) : null}
                    </span>
                  </SelectableRow>
                </li>
              );
            })}
          </ul>
        </ScrollFade>
      )}
    </div>
  );
};
