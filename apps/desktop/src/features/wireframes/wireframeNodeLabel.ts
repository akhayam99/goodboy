import type { WireframeNode } from '@goodboy/core';

const MAX_LABEL = 48;

const clip = ({ text }: { readonly text: string }): string =>
  text.length <= MAX_LABEL ? text : `${text.slice(0, MAX_LABEL - 1).trimEnd()}…`;

const humanize = ({ id }: { readonly id: string }): string => {
  const words = id.replace(/[-_]+/g, ' ').trim();
  if (words.length === 0) {
    return id;
  }
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

export const wireframeNodeLabel = ({ node }: { readonly node: WireframeNode }): string => {
  switch (node.kind) {
    case 'text':
      return clip({ text: node.text });
    case 'button':
      return clip({ text: node.label });
    case 'input':
      return clip({ text: node.label ?? node.placeholder ?? humanize({ id: node.id }) });
    case 'image':
      return clip({ text: node.alt });
    case 'stack':
    case 'grid':
    case 'list':
    case 'table':
    case 'navigation':
      return humanize({ id: node.id });
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};
