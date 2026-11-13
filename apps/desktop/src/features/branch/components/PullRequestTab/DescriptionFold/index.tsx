import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, cn } from '@goodboy/ui';

type Props = {
  readonly children: ReactNode;
};

export const DescriptionFold = ({ children }: Props) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (body === null || isOpen) {
      return;
    }
    const measure = () => setIsOverflowing(body.scrollHeight > body.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    const content = body.firstElementChild;
    if (content !== null) {
      observer.observe(content);
    }
    return () => observer.disconnect();
  }, [isOpen]);

  const canFold = isOverflowing || isOpen;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={bodyRef}
        data-folded={canFold && !isOpen ? 'true' : undefined}
        onFocus={() => setIsOpen(true)}
        className={cn(
          'min-w-0',
          !isOpen && 'max-h-80 overflow-hidden',
          !isOpen && isOverflowing && 'mask-b-from-50%',
        )}
      >
        {children}
      </div>
      {canFold ? (
        <Button
          size="xs"
          variant="quiet"
          aria-expanded={isOpen}
          className="w-fit"
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        >
          {isOpen ? 'Show less' : 'Show the full description'}
        </Button>
      ) : null}
    </div>
  );
};
