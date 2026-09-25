import { Fragment } from 'react';
import { SYNTAX_CLASS, type SyntaxToken } from '../../lib/highlight';

type Props = {
  text: string;
  tokens: ReadonlyArray<SyntaxToken> | null;
};

export const SyntaxText = ({ text, tokens }: Props) => {
  if (tokens === null) {
    return <>{text}</>;
  }
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === 'plain' ? (
          <Fragment key={index}>{token.text}</Fragment>
        ) : (
          <span key={index} className={SYNTAX_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </>
  );
};
