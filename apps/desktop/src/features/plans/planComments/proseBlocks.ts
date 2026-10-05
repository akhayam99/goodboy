import type { ArtifactCommentAnchor } from '@goodboy/types';
import {
  normalizeText,
  PROSE_ORDER_BASE,
  proseOrderOf,
  type ProseSection,
} from './planCommentAnchors';

const PROSE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, pre';

const SLOT_SELECTOR = '[data-comment-slot]';

export type ProseBlock = Readonly<{
  order: number;
  text: string;
  element: HTMLElement;
}>;

const ownTextOf = ({ element }: { readonly element: HTMLElement }): string => {
  const copy = element.cloneNode(true);
  if (!(copy instanceof HTMLElement)) {
    return '';
  }
  for (const nested of copy.querySelectorAll(`ul, ol, ${SLOT_SELECTOR}`)) {
    nested.remove();
  }
  return normalizeText({ text: copy.textContent ?? '' });
};

export const readProseBlocks = ({
  root,
  section,
}: {
  readonly root: HTMLElement;
  readonly section: ProseSection;
}): ReadonlyArray<ProseBlock> => {
  const found = [...root.querySelectorAll<HTMLElement>(PROSE_BLOCK_SELECTOR)].filter(
    (element) => element.closest(SLOT_SELECTOR) === null,
  );
  return found.flatMap((element, index) => {
    const text = ownTextOf({ element });
    return text.length === 0 ? [] : [{ order: PROSE_ORDER_BASE[section] + index, text, element }];
  });
};

export const blockOfNode = ({
  node,
  blocks,
}: {
  readonly node: Node | null;
  readonly blocks: ReadonlyArray<ProseBlock>;
}): ProseBlock | null => {
  const start = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  if (start?.closest(SLOT_SELECTOR) != null) {
    return null;
  }
  const element = start?.closest<HTMLElement>(PROSE_BLOCK_SELECTOR) ?? null;
  return blocks.find((block) => block.element === element) ?? null;
};

const matches = ({
  anchor,
  block,
}: {
  readonly anchor: ArtifactCommentAnchor;
  readonly block: ProseBlock;
}): boolean => {
  if (anchor.kind === 'part') {
    return false;
  }
  const wanted = normalizeText({ text: anchor.text });
  return anchor.kind === 'block' ? block.text === wanted : block.text.includes(wanted);
};

export const blockForAnchor = ({
  anchor,
  blocks,
}: {
  readonly anchor: ArtifactCommentAnchor;
  readonly blocks: ReadonlyArray<ProseBlock>;
}): ProseBlock | null => {
  const order = proseOrderOf({ anchor });
  if (order === null) {
    return null;
  }
  const atOrder = blocks.find((block) => block.order === order && matches({ anchor, block }));
  return atOrder ?? blocks.find((block) => matches({ anchor, block })) ?? null;
};
