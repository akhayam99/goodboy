import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { DrawerFrame, EmptyState } from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { DraftCard } from '../ReviewPane/WriteReview/DraftCard';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const ReviewDraftsDrawer = ({ sessionId, onClose }: Props) => {
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);
  const open = useMemo(() => drafts.filter((draft) => draft.status === 'draft'), [drafts]);
  const groups = useMemo(() => {
    const byPath = new Map<string, PrReviewDraft[]>();
    for (const draft of open) {
      const list = byPath.get(draft.path) ?? [];
      list.push(draft);
      byPath.set(draft.path, list);
    }
    return [...byPath.entries()].map(([path, items]) => ({
      path,
      items: [...items].sort((a, b) => a.line - b.line),
    }));
  }, [open]);

  return (
    <DrawerFrame
      title="Drafts"
      icon={MessageSquare}
      iconClassName="text-muted-foreground"
      count={open.length}
      closeLabel="Close drafts"
      onClose={onClose}
    >
      {groups.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.review}
          tone={CONCEPT_TONE.review}
          title="No draft comments yet"
          description="Ask the agent to draft comments, or click a line number in the diff."
          size="inline"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.path} className="flex flex-col gap-1.5">
              <span className="truncate font-mono text-2xs text-muted-foreground">
                {group.path}
              </span>
              {group.items.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onEdit={(body) => void updateReviewDraft(draft.id, body)}
                  onDiscard={() => void discardReviewDraft(draft.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </DrawerFrame>
  );
};
