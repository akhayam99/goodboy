import { useCallback, useEffect, useState, type RefObject } from 'react';
import { normalizeText } from '../planCommentAnchors';
import { blockOfNode, type ProseBlock } from '../proseBlocks';

const SELECTION_LIMIT = 600;
const CHIP_GAP = 6;

export type ProseSelection = Readonly<{
  block: ProseBlock;
  text: string;
  top: number;
  left: number;
}>;

type Params = {
  readonly wrapperRef: RefObject<HTMLElement | null>;
  readonly blocks: ReadonlyArray<ProseBlock>;
  readonly isEnabled: boolean;
};

export const useProseSelection = ({ wrapperRef, blocks, isEnabled }: Params) => {
  const [selection, setSelection] = useState<ProseSelection | null>(null);

  const read = useCallback(() => {
    const wrapper = wrapperRef.current;
    const current = window.getSelection();
    if (!isEnabled || wrapper === null || current === null || current.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const range = current.getRangeAt(0);
    const text = normalizeText({ text: current.toString() });
    const block = blockOfNode({ node: range.startContainer, blocks });
    const isInside = wrapper.contains(range.startContainer) && wrapper.contains(range.endContainer);
    if (current.isCollapsed || text.length === 0 || block === null || !isInside) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const frame = wrapper.getBoundingClientRect();
    setSelection({
      block,
      text: text.length <= SELECTION_LIMIT ? text : text.slice(0, SELECTION_LIMIT).trimEnd(),
      top: Math.max(rect.bottom - frame.top + CHIP_GAP, 0),
      left: Math.max(rect.left - frame.left, 0),
    });
  }, [blocks, isEnabled, wrapperRef]);

  useEffect(() => {
    const onChange = () => {
      const current = window.getSelection();
      if (current === null || current.isCollapsed) {
        setSelection(null);
      }
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  return { selection: isEnabled ? selection : null, onMouseUp: read, onKeyUp: read, clear };
};
