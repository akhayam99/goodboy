import { memo, type ReactNode } from 'react';
import { ctxTagLabel } from './ctxTagStyle';
import { freshenNode, type FreshTail } from './freshenNode';
import { parseInline, type InlineNode } from './parseInline';

type Props = {
  readonly text: string;
  readonly className?: string;
  readonly fresh?: FreshTail | undefined;
};

const CODE_CLASS = 'rounded-md bg-muted px-1 py-0 font-mono text-foreground';

type RenderParams = {
  readonly nodes: ReadonlyArray<InlineNode>;
  readonly keyPrefix: string;
};

const renderNodes = ({ nodes, keyPrefix }: RenderParams): ReactNode =>
  nodes.map((node, position) => {
    const key = `${keyPrefix}-${position}`;
    switch (node.kind) {
      case 'text':
        return node.value;
      case 'code':
        return (
          <code key={key} className={CODE_CLASS}>
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={key} className="font-semibold">
            {renderNodes({ nodes: node.children, keyPrefix: key })}
          </strong>
        );
      case 'em':
        return <em key={key}>{renderNodes({ nodes: node.children, keyPrefix: key })}</em>;
      case 'del':
        return <del key={key}>{renderNodes({ nodes: node.children, keyPrefix: key })}</del>;
      case 'link':
        return renderNodes({ nodes: node.children, keyPrefix: key });
      case 'image':
        return node.alt;
      case 'chip':
        return node.label ?? ctxTagLabel({ tag: node.tag });
      default: {
        const exhaustive: never = node;
        return exhaustive;
      }
    }
  });

const InlineMarkdownImpl = ({ text, className, fresh }: Props) => {
  const node = renderNodes({ nodes: parseInline({ text }), keyPrefix: 'i' });
  return (
    <span className={className}>
      {fresh === undefined ? node : freshenNode({ node, tail: fresh })}
    </span>
  );
};

export const InlineMarkdown = memo(InlineMarkdownImpl);
