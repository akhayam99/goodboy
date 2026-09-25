import { isValidElement, type ReactNode } from 'react';

type ChildrenProps = {
  readonly children?: ReactNode;
};

type Params = {
  readonly node: ReactNode;
};

export const isPresentNode = ({ node }: Params): boolean => {
  if (node == null || typeof node === 'boolean') {
    return false;
  }
  if (typeof node === 'string') {
    return node.trim() !== '';
  }
  if (typeof node === 'number') {
    return node !== 0;
  }
  if (Array.isArray(node)) {
    return node.some((child: ReactNode) => isPresentNode({ node: child }));
  }
  if (isValidElement<ChildrenProps>(node) && node.props.children !== undefined) {
    return isPresentNode({ node: node.props.children });
  }
  return true;
};
