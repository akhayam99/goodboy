type Params = {
  readonly text: string;
};

type Block = { readonly kind: 'markdown' | 'diff'; readonly text: string };

export const proposalBlocksOf = ({ text }: Params): ReadonlyArray<Block> => {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let fence = '';
  let isDiff = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    const marker = /^(\x60{3,}|~{3,})/.exec(trimmed)?.[1];
    if (
      fence !== '' &&
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      trimmed.trim() === marker
    ) {
      fence = '';
      if (isDiff) {
        blocks.push({ kind: 'diff', text: buffer.join('\n') });
        buffer = [];
        isDiff = false;
        continue;
      }
      buffer.push(line);
      continue;
    }
    if (fence === '' && marker !== undefined) {
      fence = marker;
      if (trimmed.slice(marker.length).trim() === 'diff') {
        if (buffer.length > 0) {
          blocks.push({ kind: 'markdown', text: buffer.join('\n') });
        }
        buffer = [];
        isDiff = true;
        continue;
      }
    }
    buffer.push(line);
  }
  if (buffer.length > 0) {
    blocks.push({ kind: isDiff ? 'diff' : 'markdown', text: buffer.join('\n') });
  }
  return blocks;
};
