import type { DiffLineTarget } from '../../components/DiffView/types';

const lineRef = (target: DiffLineTarget): string => {
  const { anchor } = target;
  const range =
    anchor.endLineNumber && anchor.endLineNumber !== anchor.lineNumber
      ? `${anchor.lineNumber}-${anchor.endLineNumber}`
      : `${anchor.lineNumber}`;
  return `${target.filePath}:${range}`;
};

export const askAgentPrompt = (target: DiffLineTarget): string => {
  const quoted = target.text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const note = target.note === undefined ? '' : `\n${target.note}\n`;
  return `About \`${lineRef(target)}\`:\n${quoted}\n${note}`;
};
