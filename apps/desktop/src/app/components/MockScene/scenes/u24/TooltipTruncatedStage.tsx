import { useEffect, useRef } from 'react';
import { TruncatedText } from '@goodboy/ui';

const SHOW_AFTER_MS = 450;

const FILE_NAME = 'settlement-reconciliation-rounding.test.ts';

export const TooltipTruncatedStage = () => {
  const nameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const name = nameRef.current;
    if (name === null) {
      return;
    }
    const timer = setTimeout(() => {
      name.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      data-testid="tooltip-truncated"
      className="flex w-60 flex-col gap-2 rounded-lg border border-border-soft bg-subtle p-4 pb-14"
    >
      <span className="text-meta text-faint-foreground">Cut name</span>
      <TruncatedText ref={nameRef} className="text-label text-foreground">
        {FILE_NAME}
      </TruncatedText>
      <span className="text-meta text-faint-foreground">Whole name</span>
      <TruncatedText className="text-label text-foreground">rounding.ts</TruncatedText>
    </div>
  );
};
