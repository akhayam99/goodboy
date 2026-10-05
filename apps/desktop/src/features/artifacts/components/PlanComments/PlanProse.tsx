import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ArtifactComment, ArtifactCommentAnchor } from '@goodboy/types';
import { ArtifactProse } from '../ArtifactProse';
import { isInSection, type ProseSection } from '../../../plans/planComments/planCommentAnchors';
import { blockForAnchor } from '../../../plans/planComments/proseBlocks';
import { useProseBlocks } from '../../../plans/planComments/useProseBlocks';
import { useProseHover } from '../../../plans/planComments/useProseHover';
import { useProseSelection } from '../../../plans/planComments/useProseSelection';
import { usePlanCommentsApi } from '../../../plans/planComments/usePlanCommentsApi';
import { CommentButton } from './CommentButton';
import { CommentThread } from './CommentThread';

type Props = {
  readonly text: string;
  readonly section: ProseSection;
  readonly hasLead?: boolean;
  readonly measure?: 'reading' | 'full';
};

const NO_COMMENTS: ReadonlyArray<ArtifactComment> = [];

export const PlanProse = ({ text, section, hasLead = true, measure = 'reading' }: Props) => {
  const api = usePlanCommentsApi();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const comments = api?.comments ?? NO_COMMENTS;
  const composing = api?.composing ?? null;
  const canComment = api?.canComment ?? false;

  const here = useMemo(
    () => comments.filter((comment) => isInSection({ anchor: comment.anchor, section })),
    [comments, section],
  );
  const anchors = useMemo(() => {
    const list: Array<ArtifactCommentAnchor> = here.map((comment) => comment.anchor);
    if (composing !== null && isInSection({ anchor: composing.anchor, section })) {
      list.push(composing.anchor);
    }
    return list;
  }, [here, composing, section]);

  const { blocks, slots } = useProseBlocks({ wrapperRef, text, section, anchors });
  const { hover, onMouseOver, onMouseLeave } = useProseHover({
    wrapperRef,
    blocks,
    isEnabled: canComment && composing === null,
  });
  const { selection, onMouseUp, onKeyUp, clear } = useProseSelection({
    wrapperRef,
    blocks,
    isEnabled: canComment && composing === null,
  });

  const placed = useMemo(() => {
    const byOrder = new Map<number, Array<ArtifactComment>>();
    const orphans: Array<ArtifactComment> = [];
    for (const comment of here) {
      const block = blockForAnchor({ anchor: comment.anchor, blocks });
      if (block === null) {
        orphans.push(comment);
        continue;
      }
      byOrder.set(block.order, [...(byOrder.get(block.order) ?? []), comment]);
    }
    return { byOrder, orphans: blocks.length === 0 ? NO_COMMENTS : orphans };
  }, [here, blocks]);

  const isComposingHere = composing !== null && isInSection({ anchor: composing.anchor, section });
  const composingOrder =
    composing === null || !isComposingHere
      ? null
      : (blockForAnchor({ anchor: composing.anchor, blocks })?.order ?? null);
  const isComposingOrphan = isComposingHere && composingOrder === null && blocks.length > 0;
  const threadOrders = [
    ...new Set([...placed.byOrder.keys(), ...(composingOrder === null ? [] : [composingOrder])]),
  ];

  return (
    <div
      ref={wrapperRef}
      data-testid="plan-prose-comments"
      className="relative min-w-0"
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onKeyUp={onKeyUp}
    >
      <ArtifactProse text={text} hasLead={hasLead} measure={measure} />
      {hover === null ? null : (
        <div className="absolute right-0" style={{ top: hover.top }}>
          <CommentButton
            label="Comment on this text"
            onClick={() =>
              api?.startComposing({
                anchor: { kind: 'block', order: hover.block.order, text: hover.block.text },
              })
            }
          />
        </div>
      )}
      {selection === null ? null : (
        <div
          className="absolute z-10 shadow-md"
          style={{ top: selection.top, left: selection.left }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommentButton
            label="Comment on the selected text"
            onClick={() => {
              api?.startComposing({
                anchor: {
                  kind: 'quote',
                  order: selection.block.order,
                  text: selection.text,
                  blockText: selection.block.text,
                },
              });
              clear();
            }}
          />
        </div>
      )}
      {threadOrders.map((order) => {
        const slot = slots[order];
        if (slot === undefined) {
          return null;
        }
        return createPortal(
          <div className="pt-2">
            <CommentThread
              comments={placed.byOrder.get(order) ?? NO_COMMENTS}
              isComposing={composingOrder === order}
            />
          </div>,
          slot,
          `thread-${order}`,
        );
      })}
      {placed.orphans.length === 0 && !isComposingOrphan ? null : (
        <div className="pt-2">
          <CommentThread
            comments={placed.orphans}
            isComposing={isComposingOrphan}
            label="On text the planner changed"
          />
        </div>
      )}
    </div>
  );
};
