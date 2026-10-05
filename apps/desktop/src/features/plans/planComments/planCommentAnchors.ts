import type { ArtifactComment, ArtifactCommentAnchor } from '@goodboy/types';

const PARTS_ORDER_BASE = 1000;
const REST_ORDER_BASE = 2000;

export type ProseSection = 'lead' | 'rest';

export const PROSE_ORDER_BASE: Readonly<Record<ProseSection, number>> = {
  lead: 0,
  rest: REST_ORDER_BASE,
};

const anchorOrder = ({ anchor }: { readonly anchor: ArtifactCommentAnchor }): number =>
  anchor.kind === 'part' ? PARTS_ORDER_BASE + anchor.index : anchor.order;

export const sortByAnchor = ({
  comments,
}: {
  readonly comments: ReadonlyArray<ArtifactComment>;
}): ReadonlyArray<ArtifactComment> =>
  comments
    .map((comment, position) => ({ comment, position }))
    .sort(
      (left, right) =>
        anchorOrder({ anchor: left.comment.anchor }) -
          anchorOrder({ anchor: right.comment.anchor }) || left.position - right.position,
    )
    .map((entry) => entry.comment);

export const anchorHead = ({ anchor }: { readonly anchor: ArtifactCommentAnchor }): string => {
  if (anchor.kind === 'part') {
    return `On part ${anchor.index + 1} "${anchor.title}":`;
  }
  return anchor.order < PARTS_ORDER_BASE ? 'On the goal:' : 'On the plan text:';
};

export const quoteOf = ({ anchor }: { readonly anchor: ArtifactCommentAnchor }): string | null => {
  if (anchor.kind === 'quote') {
    return anchor.text;
  }
  return anchor.kind === 'block' ? anchor.text : null;
};

export const proseOrderOf = ({
  anchor,
}: {
  readonly anchor: ArtifactCommentAnchor;
}): number | null => (anchor.kind === 'part' ? null : anchor.order);

export const isInSection = ({
  anchor,
  section,
}: {
  readonly anchor: ArtifactCommentAnchor;
  readonly section: ProseSection;
}): boolean => {
  const order = proseOrderOf({ anchor });
  if (order === null) {
    return false;
  }
  return section === 'rest' ? order >= REST_ORDER_BASE : order < PARTS_ORDER_BASE;
};

export const normalizeText = ({ text }: { readonly text: string }): string =>
  text.replace(/\s+/g, ' ').trim();

export const commentsForPart = ({
  comments,
  index,
}: {
  readonly comments: ReadonlyArray<ArtifactComment>;
  readonly index: number;
}): ReadonlyArray<ArtifactComment> =>
  comments.filter((comment) => comment.anchor.kind === 'part' && comment.anchor.index === index);
