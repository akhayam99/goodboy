import { createElement, useState, type ComponentProps, type MouseEvent } from 'react';
import { cn } from '../cn';
import { Tooltip, type TooltipSide } from './Tooltip';

export type TruncatedTextTag = 'span' | 'div' | 'p' | 'h1' | 'h3' | 'code' | 'li' | 'dd' | 'td';

export type TruncatedTextProps = Omit<ComponentProps<'span'>, 'title'> & {
  as?: TruncatedTextTag;
  tooltip?: string;
  side?: TooltipSide;
};

const isCut = (element: HTMLElement): boolean =>
  element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

const textOf = (children: React.ReactNode): string | undefined => {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  return undefined;
};

export const TruncatedText = ({
  as = 'span',
  tooltip,
  side,
  className,
  children,
  onMouseEnter,
  ...rest
}: TruncatedTextProps) => {
  const [isTextCut, setIsTextCut] = useState(false);
  const content = tooltip ?? textOf(children);

  const measure = (event: MouseEvent<HTMLSpanElement>) => {
    setIsTextCut(isCut(event.currentTarget));
    onMouseEnter?.(event);
  };

  return (
    <Tooltip content={isTextCut ? content : undefined} side={side}>
      {createElement(
        as,
        { ...rest, className: cn('truncate', className), onMouseEnter: measure },
        children,
      )}
    </Tooltip>
  );
};
