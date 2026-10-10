import { useEffect, useMemo, useState } from 'react';
import { ScrollFade, cn } from '@goodboy/ui';
import {
  SYNTAX_CLASS,
  highlightCode,
  languageForPath,
  type SyntaxLines,
} from '../../lib/highlight';
import { MAX_HIGHLIGHT_LINES, exceedsHighlightCap } from '../../lib/highlight/caps';

type Props = {
  readonly text: string;
  readonly path: string;
  readonly isWrapped: boolean;
};

type Highlighted = {
  readonly source: string;
  readonly lines: SyntaxLines | null;
};

const GUTTER_CLASS: Readonly<Record<number, string>> = {
  1: 'before:w-[1ch]',
  2: 'before:w-[2ch]',
  3: 'before:w-[3ch]',
  4: 'before:w-[4ch]',
  5: 'before:w-[5ch]',
  6: 'before:w-[6ch]',
};

const LINE_CLASS =
  'flex gap-4 px-3 before:shrink-0 before:select-none before:text-right before:text-faint-foreground before:content-[counter(source-line)] before:[counter-increment:source-line]';

type TextParams = {
  readonly text: string;
};

type ReasonParams = {
  readonly lineCount: number;
  readonly source: string;
};

const linesOf = ({ text }: TextParams): ReadonlyArray<string> => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

const plainReasonOf = ({ lineCount, source }: ReasonParams): string | null => {
  if (lineCount > MAX_HIGHLIGHT_LINES) {
    return 'Shown without colours: over 5,000 lines.';
  }
  if (exceedsHighlightCap(source)) {
    return 'Shown without colours: a line is over 1,000 characters.';
  }
  return null;
};

export const SourceView = ({ text, path, isWrapped }: Props) => {
  const lang = useMemo(() => languageForPath(path), [path]);
  const lines = useMemo(() => linesOf({ text }), [text]);
  const source = useMemo(() => lines.join('\n'), [lines]);
  const plainReason = useMemo(
    () => (lang === null ? null : plainReasonOf({ lineCount: lines.length, source })),
    [lang, lines.length, source],
  );
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);

  useEffect(() => {
    if (lang === null || plainReason !== null) {
      return;
    }
    let isCancelled = false;
    void highlightCode(source, lang).then((result) => {
      if (!isCancelled) {
        setHighlighted({ source, lines: result });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [lang, plainReason, source]);

  const tokens = highlighted?.source === source ? highlighted.lines : null;
  const gutterClass = GUTTER_CLASS[String(lines.length).length] ?? 'before:w-[7ch]';

  const rows = (
    <div
      data-source-view=""
      className={cn(
        'flex flex-col [counter-reset:source-line]',
        isWrapped ? 'w-full' : 'w-max min-w-full',
      )}
    >
      {lines.map((line, index) => (
        <div key={index} className={cn(LINE_CLASS, gutterClass)}>
          <span
            className={cn(
              'min-w-0',
              isWrapped ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
            )}
          >
            {tokens?.[index] === undefined
              ? line
              : tokens[index].map((token, tokenIndex) => (
                  <span key={tokenIndex} className={SYNTAX_CLASS[token.kind]}>
                    {token.text}
                  </span>
                ))}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3">
      {plainReason === null ? null : (
        <p className="text-label text-muted-foreground">{plainReason}</p>
      )}
      <ScrollFade
        className="min-h-0 flex-1 rounded-md bg-muted"
        viewportClassName="py-2 text-code text-foreground"
        fadeFrom="muted"
        fadeSize={16}
      >
        {isWrapped ? (
          rows
        ) : (
          <ScrollFade orientation="horizontal" fadeFrom="muted" fadeSize={16}>
            {rows}
          </ScrollFade>
        )}
      </ScrollFade>
    </div>
  );
};
