import { useCallback, useState, type MouseEvent, type RefObject } from 'react';
import { blockOfNode, type ProseBlock } from '../proseBlocks';

export type ProseHover = Readonly<{ block: ProseBlock; top: number }>;

type Params = {
  readonly wrapperRef: RefObject<HTMLElement | null>;
  readonly blocks: ReadonlyArray<ProseBlock>;
  readonly isEnabled: boolean;
};

export const useProseHover = ({ wrapperRef, blocks, isEnabled }: Params) => {
  const [hover, setHover] = useState<ProseHover | null>(null);

  const onMouseOver = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const wrapper = wrapperRef.current;
      if (!isEnabled || wrapper === null || !(event.target instanceof Node)) {
        return;
      }
      const block = blockOfNode({ node: event.target, blocks });
      if (block === null) {
        return;
      }
      const top = block.element.getBoundingClientRect().top - wrapper.getBoundingClientRect().top;
      setHover((current) => (current?.block.element === block.element ? current : { block, top }));
    },
    [blocks, isEnabled, wrapperRef],
  );

  const onMouseLeave = useCallback(() => setHover(null), []);

  return { hover: isEnabled ? hover : null, onMouseOver, onMouseLeave };
};
