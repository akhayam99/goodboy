import type { DiffCommentAnchor, FileDiff } from '@goodboy/types';

type Params = {
  readonly file: FileDiff;
  readonly anchor: DiffCommentAnchor;
};

export const lineText = ({ file, anchor }: Params): string => {
  const out: string[] = [];
  const hi = anchor.endLineNumber ?? anchor.lineNumber;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const number = anchor.side === 'old' ? line.oldLine : line.newLine;
      const isOnSide = anchor.side === 'old' ? line.kind !== 'add' : line.kind !== 'del';
      if (isOnSide && number !== null && number >= anchor.lineNumber && number <= hi) {
        out.push(line.text);
      }
    }
  }
  return out.join('\n');
};
