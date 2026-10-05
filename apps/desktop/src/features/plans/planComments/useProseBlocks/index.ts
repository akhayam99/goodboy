import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ArtifactCommentAnchor } from '@goodboy/types';
import { blockForAnchor, readProseBlocks, type ProseBlock } from '../proseBlocks';
import type { ProseSection } from '../planCommentAnchors';

const NO_BLOCKS: ReadonlyArray<ProseBlock> = [];
const NO_SLOTS: Readonly<Record<number, HTMLElement>> = {};

type Params = {
  readonly wrapperRef: RefObject<HTMLElement | null>;
  readonly text: string;
  readonly section: ProseSection;
  readonly anchors: ReadonlyArray<ArtifactCommentAnchor>;
};

export const useProseBlocks = ({ wrapperRef, text, section, anchors }: Params) => {
  const [blocks, setBlocks] = useState<ReadonlyArray<ProseBlock>>(NO_BLOCKS);
  const [slots, setSlots] = useState<Readonly<Record<number, HTMLElement>>>(NO_SLOTS);
  const anchorsKey = JSON.stringify(anchors);
  const anchorsRef = useRef(anchors);
  useLayoutEffect(() => {
    anchorsRef.current = anchors;
  });

  useLayoutEffect(() => {
    const root = wrapperRef.current;
    setBlocks(root === null ? NO_BLOCKS : readProseBlocks({ root, section }));
  }, [wrapperRef, text, section]);

  useLayoutEffect(() => {
    const wanted = new Set<number>();
    for (const anchor of anchorsRef.current) {
      const block = blockForAnchor({ anchor, blocks });
      if (block !== null) {
        wanted.add(block.order);
      }
    }
    const created: Array<HTMLElement> = [];
    const next: Record<number, HTMLElement> = {};
    for (const block of blocks) {
      if (!wanted.has(block.order)) {
        continue;
      }
      const slot = document.createElement('div');
      slot.dataset['commentSlot'] = String(block.order);
      const place = block.element.tagName === 'LI' ? 'append' : 'after';
      block.element[place](slot);
      created.push(slot);
      next[block.order] = slot;
    }
    setSlots(next);
    return () => {
      for (const slot of created) {
        slot.remove();
      }
    };
  }, [blocks, anchorsKey]);

  return { blocks, slots };
};
