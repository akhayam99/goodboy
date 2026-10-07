const PARTS_HEADING_RE = /^(#{1,3})\s+parts\s*$/i;
const HEADING_RE = /^(#{1,6})\s/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

type Fence = {
  readonly char: string;
  readonly size: number;
};

type FenceParams = {
  readonly line: string;
  readonly fence: Fence | null;
};

const nextFence = ({ line, fence }: FenceParams): Fence | null => {
  const run = FENCE_RE.exec(line)?.[1] ?? '';
  if (fence === null) {
    return run === '' ? null : { char: run.charAt(0), size: run.length };
  }
  const isClosing = run.charAt(0) === fence.char && run.length >= fence.size && line.trim() === run;
  return isClosing ? null : fence;
};

export const dropPartsSection = ({ text }: { readonly text: string }): string => {
  const kept: string[] = [];
  let skippedLevel = 0;
  let fence: Fence | null = null;
  for (const line of text.split('\n')) {
    const wasInFence = fence !== null;
    fence = nextFence({ line, fence });
    if (wasInFence || fence !== null) {
      if (skippedLevel === 0) {
        kept.push(line);
      }
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (skippedLevel > 0) {
      if (heading === null || (heading[1] ?? '').length > skippedLevel) {
        continue;
      }
      skippedLevel = 0;
    }
    const parts = PARTS_HEADING_RE.exec(line.trim());
    if (parts !== null) {
      skippedLevel = (parts[1] ?? '').length;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/^\n+/, '');
};
