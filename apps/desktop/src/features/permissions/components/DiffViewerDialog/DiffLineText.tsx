import { Fragment } from 'react';
import { cn } from '@goodboy/ui';
import type { DiffHunkLine } from '@goodboy/types';
import { LINE_PREFIX } from './lib';
import { SYNTAX_CLASS, highlightLine, type SyntaxLang } from './highlight';

type Props = {
  line: DiffHunkLine;
  lang: SyntaxLang | null;
};

export const DiffLineText = ({ line, lang }: Props) => (
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
    {lang
      ? highlightLine(line.text, lang).map((token, ti) =>
          token.kind === 'plain' ? (
            <Fragment key={ti}>{token.text}</Fragment>
          ) : (
            <span key={ti} className={SYNTAX_CLASS[token.kind]}>
              {token.text}
            </span>
          ),
        )
      : line.text}
  </>
);
