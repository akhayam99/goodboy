import { cn } from '@goodboy/ui';
import type { DiffHunkLine } from '@goodboy/types';
import { LINE_PREFIX } from './lib';
import { SyntaxText } from '../../../diff/components/SyntaxText';
import { tokensForLine, type DiffTokenMap } from '../../../diff/hooks/useDiffTokens';

type Props = {
  line: DiffHunkLine;
  tokens: DiffTokenMap | null;
};

export const DiffLineText = ({ line, tokens }: Props) => (
  <>
    <span
      aria-hidden
      className={cn(
        'select-none',
        line.kind === 'add'
          ? 'text-success'
          : line.kind === 'del'
            ? 'text-danger'
            : 'text-transparent',
      )}
    >
      {LINE_PREFIX[line.kind]}
    </span>
    <SyntaxText text={line.text} tokens={tokensForLine(tokens, line)} />
  </>
);
