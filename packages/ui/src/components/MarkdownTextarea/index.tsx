import { useCallback, useRef, type ComponentProps, type UIEvent as ReactUIEvent } from 'react';
import { cn } from '../../cn';
import { Textarea, type TextareaProps } from '../Textarea';
import { decorate } from './decorate';

type Props = TextareaProps & {
  live?: boolean;
};

const SHARED_BOX = 'px-4 pt-3 pb-2 pr-12 text-sm leading-relaxed';

const BACKDROP_TYPOGRAPHY =
  'whitespace-pre-wrap break-words font-sans tracking-normal text-foreground';

export function MarkdownTextarea({ live = false, className, value, onScroll, ...rest }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLTextAreaElement>) => {
      onScroll?.(event);
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.scrollTop = event.currentTarget.scrollTop;
      backdrop.scrollLeft = event.currentTarget.scrollLeft;
    },
    [onScroll],
  );

  if (!live) {
    return <Textarea className={className} value={value} onScroll={onScroll} {...rest} />;
  }

  const raw = typeof value === 'string' ? value : '';
  const text = raw.endsWith('\n') ? `${raw} ` : raw;

  return (
    <div className="relative">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-0 overflow-hidden border-0',
          SHARED_BOX,
          BACKDROP_TYPOGRAPHY,
        )}
      >
        {decorate(text)}
      </div>
      <Textarea
        className={cn('relative z-10 bg-transparent text-transparent caret-foreground', className)}
        value={value}
        onScroll={handleScroll}
        {...rest}
      />
    </div>
  );
}
