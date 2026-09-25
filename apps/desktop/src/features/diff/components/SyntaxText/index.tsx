import type { ReactNode } from 'react';
import { SYNTAX_CLASS, type SyntaxToken } from '../../lib/highlight';
import type { CharRange } from '../../lib/wordDiff';

type Props = {
  text: string;
  tokens: ReadonlyArray<SyntaxToken> | null;
  mark?: CharRange | null;
  markClassName?: string;
};

type Piece = {
  readonly text: string;
  readonly className: string;
  readonly marked: boolean;
};

const piecesOf = (
  text: string,
  tokens: ReadonlyArray<SyntaxToken> | null,
  mark: CharRange | null,
): ReadonlyArray<Piece> => {
  const source = tokens ?? [{ text, kind: 'plain' as const }];
  const out: Piece[] = [];
  let offset = 0;
  for (const token of source) {
    const start = offset;
    const end = offset + token.text.length;
    offset = end;
    const className = SYNTAX_CLASS[token.kind];
    if (mark === null || mark.end <= start || mark.start >= end) {
      out.push({ text: token.text, className, marked: false });
      continue;
    }
    const from = Math.max(mark.start, start) - start;
    const to = Math.min(mark.end, end) - start;
    if (from > 0) {
      out.push({ text: token.text.slice(0, from), className, marked: false });
    }
    out.push({ text: token.text.slice(from, to), className, marked: true });
    if (to < token.text.length) {
      out.push({ text: token.text.slice(to), className, marked: false });
    }
  }
  return out;
};

export const SyntaxText = ({ text, tokens, mark = null, markClassName }: Props) => {
  if (tokens === null && mark === null) {
    return <>{text}</>;
  }
  const nodes: ReactNode[] = piecesOf(text, tokens, mark).map((piece, index) => {
    const className = [piece.className, piece.marked ? markClassName : '']
      .filter((value) => value !== undefined && value !== '')
      .join(' ');
    if (className === '') {
      return piece.text;
    }
    return (
      <span key={index} className={className}>
        {piece.text}
      </span>
    );
  });
  return <>{nodes}</>;
};
