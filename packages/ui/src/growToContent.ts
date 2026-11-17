type Params = {
  readonly field: HTMLTextAreaElement;
  readonly minPx: number;
  readonly maxPx: number;
};

type HeldScroll = {
  readonly node: Element;
  readonly top: number;
};

type HeldParams = {
  readonly field: HTMLTextAreaElement;
};

const heldScrollsOf = ({ field }: HeldParams): ReadonlyArray<HeldScroll> => {
  const held: HeldScroll[] = [];
  for (let node: Element | null = field; node !== null; node = node.parentElement) {
    if (node.scrollTop > 0) {
      held.push({ node, top: node.scrollTop });
    }
  }
  return held;
};

export const growToContent = ({ field, minPx, maxPx }: Params): void => {
  const held = heldScrollsOf({ field });
  field.style.height = 'auto';
  const next = Math.max(minPx, Math.min(field.scrollHeight, maxPx));
  field.style.height = `${next}px`;
  field.style.overflowY = field.scrollHeight > maxPx ? 'auto' : 'hidden';
  for (const { node, top } of held) {
    if (node.scrollTop !== top) {
      node.scrollTop = top;
    }
  }
};
