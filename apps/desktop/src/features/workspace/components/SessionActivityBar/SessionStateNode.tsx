import { WorkNode, cn } from '@goodboy/ui';
import type { SessionNode } from './sessionNode';

type Props = {
  readonly node: SessionNode;
  readonly className?: string;
};

export const SessionStateNode = ({ node, className }: Props) => (
  <span aria-hidden className={cn('inline-flex shrink-0', className)} data-node-kind={node.kind}>
    <WorkNode state={node.state} mark={node.mark} tone={node.tone} label={node.label} size="sm" />
  </span>
);
