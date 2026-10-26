export const OUTPUT_TAIL_LINES = 40;

type Params = {
  readonly text: string;
  readonly maxLines?: number;
};

export type OutputTail = {
  readonly text: string;
  readonly totalLines: number;
  readonly hiddenLines: number;
};

export const outputTail = ({ text, maxLines = OUTPUT_TAIL_LINES }: Params): OutputTail => {
  const lines = text.replace(/\s+$/, '').split('\n');
  const hiddenLines = Math.max(lines.length - maxLines, 0);
  return {
    text: (hiddenLines === 0 ? lines : lines.slice(hiddenLines)).join('\n'),
    totalLines: lines.length,
    hiddenLines,
  };
};
