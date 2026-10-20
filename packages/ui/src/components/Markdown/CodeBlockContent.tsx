import { Fragment, useContext, useEffect, useState } from 'react';
import { CODE_TOKEN_CLASS, CodeHighlighterContext, type CodeLines } from './codeHighlighter';

type Props = {
  readonly content: string;
  readonly lang: string | null;
  readonly isOpen: boolean;
};

type State = {
  readonly key: string;
  readonly lines: CodeLines | null;
};

export const CodeBlockContent = ({ content, lang, isOpen }: Props) => {
  const highlighter = useContext(CodeHighlighterContext);
  const key = `${lang ?? ''}\u0000${content}`;
  const [state, setState] = useState<State>(() => ({
    key,
    lines: highlighter !== null && lang ? (highlighter.peek(content, lang) ?? null) : null,
  }));

  useEffect(() => {
    if (isOpen || highlighter === null || !lang) {
      return;
    }
    let live = true;
    void highlighter.highlight(content, lang).then((lines) => {
      if (live) {
        setState({ key: `${lang}\u0000${content}`, lines });
      }
    });
    return () => {
      live = false;
    };
  }, [content, highlighter, isOpen, lang]);

  if (isOpen) {
    return <>{content}</>;
  }

  const lines =
    state.key === key
      ? state.lines
      : highlighter !== null && lang
        ? (highlighter.peek(content, lang) ?? null)
        : null;
  if (lines === null) {
    return <>{content}</>;
  }
  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? '\n' : null}
          {line.map((token, tokenIndex) =>
            token.kind === 'plain' ? (
              <Fragment key={tokenIndex}>{token.text}</Fragment>
            ) : (
              <span key={tokenIndex} className={CODE_TOKEN_CLASS[token.kind]}>
                {token.text}
              </span>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
};
