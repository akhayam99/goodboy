import type { ReactNode } from 'react';
import { Tooltip, type TooltipProps } from './Tooltip';

export type OptionalTooltipProps = Pick<
  TooltipProps,
  'children' | 'anchorClassName' | 'side' | 'shortcut'
> & {
  readonly content: ReactNode;
};

export const OptionalTooltip = ({ content, children, ...rest }: OptionalTooltipProps) => {
  if (content === undefined || content === null || content === false || content === '') {
    return children;
  }
  return (
    <Tooltip content={content} {...rest}>
      {children}
    </Tooltip>
  );
};
