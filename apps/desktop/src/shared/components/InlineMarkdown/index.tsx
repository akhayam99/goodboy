import { memo, type ReactNode } from 'react';
import { parseInlineMarkdown, type InlineToken } from './parseInlineMarkdown';

type Props = {
  readonly text: string;
  readonly className?: string;
};

const CODE_CLASS = 'rounded-md bg-muted/50 px-1 py-0 font-mono text-foreground/90';

type RenderParams = {
  readonly tokens: ReadonlyArray<InlineToken>;
  readonly keyPrefix: string;
};

const renderTokens = ({ tokens, keyPrefix }: RenderParams): ReactNode =>
  tokens.map((token, position) => {
    const key = `${keyPrefix}-${position}`;
    if (token.kind === 'text') {
      return token.value;
    }
    if (token.kind === 'code') {
      return (
        <code key={key} className={CODE_CLASS}>
          {token.value}
        </code>
      );
    }
    if (token.kind === 'strong') {
      return (
        <strong key={key} className="font-semibold">
          {renderTokens({ tokens: token.children, keyPrefix: key })}
        </strong>
      );
    }
    return <em key={key}>{renderTokens({ tokens: token.children, keyPrefix: key })}</em>;
  });

const InlineMarkdownImpl = ({ text, className }: Props) => (
  <span className={className}>
    {renderTokens({ tokens: parseInlineMarkdown({ text }), keyPrefix: 'i' })}
  </span>
);

export const InlineMarkdown = memo(InlineMarkdownImpl);
